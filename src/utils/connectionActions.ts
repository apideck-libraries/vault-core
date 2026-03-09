import { useToast } from '@apideck/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings, VaultAction } from '../types/Session';
import { useConnections } from './useConnections';
import { useSession } from './useSession';
import {
  generateAndStoreNonce,
  verifyAndClearNonce,
  clearNonce,
} from './oauthCsrf';
import { REDIRECT_URL } from '../constants/urls';

export const useConnectionActions = () => {
  const { selectedConnection, updateConnection, connectionsUrl, headers } =
    useConnections();
  const { session } = useSession();
  const [isReAuthorizing, setIsReAuthorizing] = useState(false);
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const { t } = useTranslation();

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
      const child = window.open(
        url,
        '_blank',
        'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
      );
      const checkChild = () => {
        if (child?.closed) {
          clearInterval(timer);
          mutate(
            `${connectionsUrl}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`
          ).then((result) => {
            onConnectionChange?.(result.data);
          });
          setIsReAuthorizing(false);
        }
      };
      const timer = setInterval(checkChild, 500);
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

  const handleAuthorize = async (
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
      return;
    }

    const serviceId = selectedConnection!.service_id;
    const unifiedApi = selectedConnection!.unified_api;
    const nonce = generateAndStoreNonce(serviceId);

    const authorizeBody: Record<string, string> = {
      nonce,
      redirect_uri: session?.redirect_uri ?? REDIRECT_URL,
    };

    try {
      const authorizeResponse = await fetch(
        `${connectionsUrl}/${unifiedApi}/${serviceId}/authorize`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(authorizeBody),
        }
      );
      const authorizeData = await authorizeResponse.json();

      if (!authorizeResponse.ok || authorizeData.error) {
        addToast({
          title: t('Something went wrong'),
          description:
            authorizeData.message ||
            t('Could not start authorization'),
          type: 'error',
          autoClose: true,
        });
        clearNonce(serviceId);
        setIsReAuthorizing(false);
        return;
      }

      const { authorize_url } = authorizeData.data;

      const windowFeatures =
        'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0';
      const child = window.open(authorize_url, '_blank', windowFeatures);

      if (!child) {
        addToast({
          title: t('Something went wrong'),
          description: t(
            'Popup was blocked. Please allow popups and try again.'
          ),
          type: 'error',
          autoClose: true,
        });
        clearNonce(serviceId);
        setIsReAuthorizing(false);
        return;
      }

      let messageReceived = false;

      const doCleanup = () => {
        clearInterval(timer);
        window.removeEventListener('message', messageHandler);
        clearNonce(serviceId);
        setIsReAuthorizing(false);
      };

      const messageHandler = async (event: MessageEvent) => {
        const { data } = event;

        if (
          data?.type === 'oauth_complete' &&
          data?.serviceId === serviceId
        ) {
          messageReceived = true;

          if (!verifyAndClearNonce(serviceId, data.nonce)) {
            addToast({
              title: t('Something went wrong'),
              description: t('Authorization verification failed'),
              type: 'error',
              autoClose: true,
            });
            doCleanup();
            return;
          }

          try {
            const confirmResponse = await fetch(
              `${connectionsUrl}/${unifiedApi}/${serviceId}/confirm`,
              {
                method: 'POST',
                headers: {
                  ...headers,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  confirm_token: data.confirmToken,
                }),
              }
            );
            const confirmData = await confirmResponse.json();

            if (!confirmResponse.ok || confirmData.error) {
              addToast({
                title: t('Something went wrong'),
                description:
                  confirmData.message ||
                  t('Could not confirm authorization'),
                type: 'error',
                autoClose: true,
              });
            }
          } catch (error) {
            addToast({
              title: t('Something went wrong'),
              description: t('Could not confirm authorization'),
              type: 'error',
              autoClose: true,
            });
          }

          mutate(
            `${connectionsUrl}/${unifiedApi}/${serviceId}`
          ).then((result) => {
            onConnectionChange?.(result.data);
          });
          mutate('/vault/connections');
          doCleanup();
        }

        if (
          data?.type === 'oauth_error' &&
          data?.serviceId === serviceId
        ) {
          messageReceived = true;
          addToast({
            title: t('Something went wrong'),
            description:
              data.errorDescription || t('Authorization failed'),
            type: 'error',
            autoClose: true,
          });
          doCleanup();
        }
      };

      window.addEventListener('message', messageHandler);

      const checkChild = () => {
        if (child.closed) {
          if (!messageReceived) {
            mutate(
              `${connectionsUrl}/${unifiedApi}/${serviceId}`
            ).then((result) => {
              onConnectionChange?.(result.data);
            });
          }
          doCleanup();
        }
      };

      const timer = setInterval(checkChild, 500);
    } catch (error) {
      addToast({
        title: t('Something went wrong'),
        description: t(
          'The integration could not be authorized. Please make sure your settings are correct and try again.'
        ),
        type: 'error',
        autoClose: true,
      });
      clearNonce(serviceId);
      setIsReAuthorizing(false);
    }
  };

  return {
    isReAuthorizing,
    handleRedirect,
    handleAuthorize,
    handleDisable,
    handleEnable,
    isActionAllowedForSettings,
  };
};
