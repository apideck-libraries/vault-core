import { Button, useToast } from '@apideck/components';
import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Connection } from '../types/Connection';
import { generateNonce, storeNonce, retrieveAndClearNonce } from '../utils/oauthNonce';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';

interface Props {
  connection: Connection;
  onConnectionChange?: (connection: Connection) => any;
  autoStartAuthorization?: boolean;
}

const AuthorizeButton = ({
  connection,
  onConnectionChange,
  autoStartAuthorization,
}: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const { connectionsUrl, headers } = useConnections();
  const { addToast } = useToast();
  const {
    session: { theme },
  } = useSession();
  const { mutate } = useSWRConfig();
  const { t } = useTranslation();

  const isAuthorizationEnabled =
    connection.integration_state !== 'needs_configuration' && !isLoading;

  const handleChildWindowClose = () => {
    mutate(
      `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
    ).then((result) => {
      onConnectionChange?.(result.data);
    });
    setIsLoading(false);
  };

  const authorizeConnection = async () => {
    setIsLoading(true);
    if (
      connection.oauth_grant_type === 'client_credentials' ||
      connection.oauth_grant_type === 'password'
    ) {
      try {
        const response: any = await fetch(
          `${connectionsUrl}/${connection.unified_api}/${connection.service_id}/token`,
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
          title: `Authorized ${connection.name}`,
          type: 'success',
          autoClose: true,
        });
        mutate(
          `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
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
        setIsLoading(false);
      }
    } else {
      const serviceId = connection.service_id;
      const nonce = generateNonce();
      storeNonce(serviceId, nonce);

      try {
        const response: any = await fetch(
          `${connectionsUrl}/${connection.unified_api}/${serviceId}/authorize`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ nonce }),
          }
        );
        const data = await response.json();
        if (data.error) {
          retrieveAndClearNonce(serviceId);
          addToast({
            title: t('Something went wrong'),
            description: data.message,
            type: 'error',
            autoClose: true,
          });
          setIsLoading(false);
          return;
        }

        const child = window.open(
          data.data?.authorize_url,
          '_blank',
          'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
        );
        const timer = setInterval(() => {
          if (child?.closed) {
            clearInterval(timer);
            // If nonce is still in sessionStorage, postMessage was never received
            retrieveAndClearNonce(serviceId);
            handleChildWindowClose();
          }
        }, 500);
      } catch (error) {
        retrieveAndClearNonce(serviceId);
        addToast({
          title: t('Something went wrong'),
          description: t(
            'The integration could not be authorized. Please make sure your settings are correct and try again.'
          ),
          type: 'error',
          autoClose: true,
        });
        setIsLoading(false);
      }
    }
  };

  // Auto start authorization if the connection is enabled and the autoStartAuthorization flag is true
  useEffect(() => {
    if (autoStartAuthorization && isAuthorizationEnabled) {
      authorizeConnection();
    }
  }, []);

  if (connection?.service_id === 'google-drive') {
    return (
      <button
        onClick={authorizeConnection}
        disabled={
          connection.integration_state === 'needs_configuration' || isLoading
        }
        className={`h-[58px] ${isLoading ? 'animate-pulse' : ''}`}
      >
        <img
          src="https://vault.apideck.com/img/google-button.png"
          className="h-full"
        />
      </button>
    );
  }

  if (connection?.service_id === 'quickbooks') {
    return (
      <button
        onClick={authorizeConnection}
        disabled={
          connection.integration_state === 'needs_configuration' || isLoading
        }
        className={`h-[40px] ${isLoading ? 'animate-pulse' : ''}`}
      >
        <img
          src="https://vault.apideck.com/img/quickbooks-button.png"
          className="h-full"
        />
      </button>
    );
  }

  return (
    <Button
      text={t('Authorize')}
      isLoading={isLoading}
      disabled={!isAuthorizationEnabled}
      size="large"
      className="w-full !truncate"
      onClick={authorizeConnection}
      style={
        theme?.primary_color ? { backgroundColor: theme.primary_color } : {}
      }
    />
  );
};

export default AuthorizeButton;
