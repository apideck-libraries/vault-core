import { useToast } from '@apideck/components';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { OAuthPostMessage } from '../types/OAuthCsrf';
import { SessionSettings, VaultAction } from '../types/Session';
import { callConfirmEndpoint } from './oauthCsrf';
import { useConnections } from './useConnections';

export const useConnectionActions = () => {
  const { selectedConnection, updateConnection, connectionsUrl, headers } =
    useConnections();
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
    onConnectionChange?: (connection: Connection) => any
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
      const serviceId = selectedConnection?.service_id;
      const unifiedApi = selectedConnection?.unified_api;

      let completed = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let graceTimeout: ReturnType<typeof setTimeout> | undefined;

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
        if (timer) clearInterval(timer);
        if (graceTimeout) clearTimeout(graceTimeout);
        cleanupRef.current = null;
        setIsReAuthorizing(false);
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

        mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`).then(
          (result) => {
            onConnectionChange?.(result?.data);
          }
        );
        mutate('/vault/connections');
        cleanup();
      };

      window.addEventListener('message', handler);
      cleanupRef.current = cleanup;

      const child = window.open(
        url,
        '_blank',
        'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
      );

      timer = setInterval(() => {
        if (child?.closed) {
          if (timer) clearInterval(timer);
          timer = undefined;
          graceTimeout = setTimeout(() => {
            if (!completed) {
              handleChildWindowClose();
              cleanup();
            }
          }, 1000);
        }
      }, 500);
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
