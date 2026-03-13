import { useToast } from '@apideck/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings, VaultAction } from '../types/Session';
import { useConnections } from './useConnections';

export const useConnectionActions = () => {
  const { selectedConnection, updateConnection, connectionsUrl, headers } =
    useConnections();
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

  return {
    isReAuthorizing,
    handleRedirect,
    handleDisable,
    handleEnable,
    isActionAllowedForSettings,
  };
};
