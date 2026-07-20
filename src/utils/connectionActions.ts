import { useToast } from '@apideck/components';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { OAuthPostMessage } from '../types/OAuthCsrf';
import { SessionSettings, VaultAction } from '../types/Session';
import { OAUTH_POPUP_FEATURES } from '../constants/oauthGrantHandoff';
import { callConfirmEndpoint } from './oauthCsrf';
import {
  openGrantHandoffPopup,
  watchPopupClose,
  watchPopupCloseAndPoll,
} from './oauthGrantHandoff';
import { useConnections } from './useConnections';
import { useSession } from './useSession';

export const useConnectionActions = () => {
  const { selectedConnection, updateConnection, connectionsUrl, headers } =
    useConnections();
  // May be undefined when no SessionProvider is mounted — deriveLaunchUrl
  // falls back to the default REDIRECT_URL origin in that case.
  const { session } = useSession();
  const [isReAuthorizing, setIsReAuthorizing] = useState(false);
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const isActionAllowedForSettings =
    (settings?: SessionSettings) =>
    (action: VaultAction): boolean => {
      if (!settings?.allow_actions) {
        return true;
      }
      return settings.allow_actions.includes(action);
    };

  const handleRedirect = async (
    url: string,
    onConnectionChange?: (connection: Connection) => any,
    grantHandoff?: { unifiedApi: string; serviceId: string }
  ) => {
    setIsReAuthorizing(true);
    if (
      selectedConnection?.oauth_grant_type === 'client_credentials' ||
      selectedConnection?.oauth_grant_type === 'password'
    ) {
      try {
        const response: any = await fetch(
          `${connectionsUrl}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}/token`,
          { method: 'POST', headers }
        );
        const data = await response.json();
        if (data.error) {
          addToast({
            title: t('Something went wrong'),
            description: data.message,
            type: 'error',
            autoClose: true,
          });
          return;
        }
        addToast({
          title: `${t('Authorized')} ${selectedConnection?.name}`,
          type: 'success',
          autoClose: true,
        });
        mutate(
          `${connectionsUrl}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`
        ).then((result) => {
          onConnectionChange?.(result.data);
        });
        mutate('/vault/connections');
      } catch (error) {
        addToast({
          title: t('Something went wrong'),
          description: t(
            'The integration could not be authorized. Please make sure your settings are correct and try again.'
          ),
          type: 'error',
          autoClose: true,
        });
      } finally {
        setIsReAuthorizing(false);
      }
    } else {
      const serviceId =
        grantHandoff?.serviceId ?? selectedConnection?.service_id;
      const unifiedApi =
        grantHandoff?.unifiedApi ?? selectedConnection?.unified_api;

      let completed = false;
      let cancelCloseWatch: (() => void) | undefined;

      const handleChildWindowClose = () => {
        mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`).then(
          (result) => {
            onConnectionChange?.(result?.data);
          }
        );
        setIsReAuthorizing(false);
      };

      const cleanup = () => {
        completed = true;
        window.removeEventListener('message', handler);
        cancelCloseWatch?.();
        cancelCloseWatch = undefined;
        cleanupRef.current = null;
        setIsReAuthorizing(false);
      };

      const refreshConnection = () => {
        mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`).then(
          (result) => {
            onConnectionChange?.(result?.data);
          }
        );
        mutate('/vault/connections');
      };

      const handler = async (event: MessageEvent) => {
        const data = event.data as OAuthPostMessage | undefined;
        if (
          !data ||
          (data.type !== 'oauth_complete' && data.type !== 'oauth_error')
        ) {
          return;
        }
        if (!serviceId || data.serviceId !== serviceId) return;

        if (data.type === 'oauth_error') {
          addToast({
            title: t('Authorization failed'),
            description: data.errorDescription || data.error,
            type: 'error',
            autoClose: true,
          });
          cleanup();
          return;
        }

        try {
          await callConfirmEndpoint({
            unifiedApi: unifiedApi as string,
            serviceId,
            confirmToken: data.confirmToken,
            connectionsUrl: connectionsUrl ?? '',
            headers,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[oauthCsrf] confirm failed', error);
          addToast({
            title: t('Could not confirm authorization'),
            description: (error as Error)?.message,
            type: 'error',
            autoClose: true,
          });
          cleanup();
          return;
        }

        refreshConnection();
        cleanup();
      };

      window.addEventListener('message', handler);
      cleanupRef.current = cleanup;

      if (grantHandoff) {
        const child = openGrantHandoffPopup({
          session,
          unifiedApi: grantHandoff.unifiedApi,
          serviceId: grantHandoff.serviceId,
          connectionsUrl: connectionsUrl ?? '',
          headers,
          legacyAuthorizeUrl: url,
        });

        cancelCloseWatch = watchPopupCloseAndPoll({
          child,
          detailUrl: `${connectionsUrl}/${unifiedApi}/${serviceId}`,
          headers,
          isCompleted: () => completed,
          onOutcome: (outcome) => {
            if (outcome === 'callable') {
              refreshConnection();
            } else {
              addToast({
                title: t('Authorization was not completed'),
                description: t(
                  'The authorization window was closed before the connection became ready. Please try again.'
                ),
                type: 'error',
                autoClose: true,
              });
            }
            cleanup();
          },
        }).cancel;
      } else {
        // Revoke (and other non-handoff) call sites: open the URL directly,
        // exactly as before — no grant mint, no handshake, no callable poll.
        const child = window.open(url, '_blank', OAUTH_POPUP_FEATURES);

        cancelCloseWatch = watchPopupClose({
          child,
          isCompleted: () => completed,
          onClosed: () => {
            handleChildWindowClose();
            cleanup();
          },
        }).cancel;
      }
    }
  };

  const handleDisable = async (
    setCurrentView?: (view: ConnectionViewType | undefined | null) => void,
    showButtonLayout?: boolean
  ) => {
    if (setCurrentView) {
      setCurrentView(
        showButtonLayout ? ConnectionViewType.ButtonMenu : undefined
      );
    }
    await updateConnection({
      unifiedApi: selectedConnection!.unified_api,
      serviceId: selectedConnection!.service_id,
      values: {
        enabled: false,
      },
    });
  };

  const handleEnable = async (
    setCurrentView?: (view: ConnectionViewType | undefined | null) => void,
    showButtonLayout?: boolean
  ) => {
    const updatedConnection = await updateConnection({
      unifiedApi: selectedConnection!.unified_api,
      serviceId: selectedConnection!.service_id,
      values: {
        enabled: true,
      },
    });
    if (updatedConnection) {
      const { state, form_fields } = updatedConnection;
      const hasFormFields = form_fields?.filter(
        (field: any) => !field.hidden
      )?.length;
      if (state !== 'callable' && hasFormFields && setCurrentView) {
        setCurrentView(ConnectionViewType.Settings);
      } else if (setCurrentView && showButtonLayout) {
        setCurrentView(ConnectionViewType.ButtonMenu);
      }
    }
  };

  return {
    isReAuthorizing,
    handleRedirect,
    handleDisable,
    handleEnable,
    isActionAllowedForSettings,
  };
};
