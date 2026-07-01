import { Button, useToast } from '@apideck/components';
import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { REDIRECT_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { OAuthPostMessage } from '../types/OAuthCsrf';
import { callConfirmEndpoint, generateNonce } from '../utils/oauthCsrf';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';

interface Props {
  connection: Connection;
  autoStartAuthorization?: boolean;
}

const AuthorizeButton = ({ connection, autoStartAuthorization }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const { connectionsUrl, headers } = useConnections();
  const { addToast } = useToast();
  const {
    session: { theme, redirect_uri },
  } = useSession();
  const { mutate } = useSWRConfig();
  const { t } = useTranslation();

  const isAuthorizationEnabled =
    connection.integration_state !== 'needs_configuration' && !isLoading;

  const authorizeUrl = `${connection.authorize_url}&redirect_uri=${
    redirect_uri ?? REDIRECT_URL
  }`;

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const handleChildWindowClose = () => {
    mutate(
      `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
    );
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
        );
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
      const unifiedApi = connection.unified_api;
      const nonce = generateNonce();

      const url = new URL(authorizeUrl);
      url.searchParams.append('nonce', nonce);

      let completed = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let graceTimeout: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        completed = true;
        window.removeEventListener('message', handler);
        if (timer) clearInterval(timer);
        if (graceTimeout) clearTimeout(graceTimeout);
        cleanupRef.current = null;
        setIsLoading(false);
      };

      const handler = async (event: MessageEvent) => {
        const data = event.data as OAuthPostMessage | undefined;
        if (
          !data ||
          (data.type !== 'oauth_complete' && data.type !== 'oauth_error')
        ) {
          return;
        }
        if (data.serviceId !== serviceId) return;

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
            unifiedApi,
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

        mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`);
        mutate('/vault/connections');
        cleanup();
      };

      window.addEventListener('message', handler);
      cleanupRef.current = cleanup;

      const child = window.open(
        url.href,
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
          alt="Sign in with Google"
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
          alt="Connect to QuickBooks"
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
