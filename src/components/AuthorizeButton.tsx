import { Button, useToast } from '@apideck/components';
import React, { useState } from 'react';

import { useSWRConfig } from 'swr';
import { REDIRECT_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';

interface Props {
  connection: Connection;
  onConnectionChange?: (connection: Connection) => any;
}

const AuthorizeButton = ({ connection, onConnectionChange }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const { connectionsUrl, headers } = useConnections();
  const { addToast } = useToast();
  const {
    session: { theme, redirect_uri },
  } = useSession();
  const { mutate } = useSWRConfig();

  const authorizeUrl = `${connection.authorize_url}&redirect_uri=${
    redirect_uri ?? REDIRECT_URL
  }`;

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
            title: `Something went wrong`,
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
          title: `Something went wrong`,
          description: `The integration could not be authorized. Please make sure your settings are correct and try again.`,
          type: 'error',
          autoClose: true,
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      const child = window.open(
        authorizeUrl,
        '_blank',
        'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
      );
      const timer = setInterval(() => {
        if (child?.closed) {
          clearInterval(timer);
          handleChildWindowClose();
        }
      }, 500);
    }
  };

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
      text={`Authorize ${connection.name}`}
      isLoading={isLoading}
      disabled={
        connection.integration_state === 'needs_configuration' || isLoading
      }
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
