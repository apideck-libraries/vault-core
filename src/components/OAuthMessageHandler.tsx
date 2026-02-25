import { useEffect } from 'react';

import { useToast } from '@apideck/components';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { retrieveAndClearNonce } from '../utils/oauthNonce';
import { useConnections } from '../utils/useConnections';

const ALLOWED_ORIGIN = 'https://vault.apideck.com';

const OAuthMessageHandler = () => {
  const { connectionsUrl, headers } = useConnections();
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== ALLOWED_ORIGIN) return;

      const { type, nonce, confirmToken, serviceId, unifiedApi, error, errorDescription } =
        event.data || {};

      if (type === 'oauth_complete') {
        const storedNonce = retrieveAndClearNonce(serviceId);
        if (!storedNonce || storedNonce !== nonce) {
          console.error(
            '[vault-core] OAuth nonce mismatch — possible CSRF attempt'
          );
          return;
        }

        try {
          const response: any = await fetch(
            `${connectionsUrl}/${unifiedApi}/${serviceId}/confirm`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({ confirm_token: confirmToken }),
            }
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

          mutate(`${connectionsUrl}/${unifiedApi}/${serviceId}`);
        } catch {
          addToast({
            title: t('Something went wrong'),
            description: t(
              'The integration could not be authorized. Please make sure your settings are correct and try again.'
            ),
            type: 'error',
            autoClose: true,
          });
        }
      }

      if (type === 'oauth_error') {
        retrieveAndClearNonce(serviceId);
        addToast({
          title: t('Something went wrong'),
          description: errorDescription || error || t('OAuth authorization failed'),
          type: 'error',
          autoClose: true,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [connectionsUrl, headers, mutate, addToast, t]);

  return null;
};

export default OAuthMessageHandler;
