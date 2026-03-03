import { Button } from '@apideck/components';
import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { useConnectionActions } from '../utils/connectionActions';
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
  const { handleAuthorize, isReAuthorizing } = useConnectionActions();
  const {
    session: { theme },
  } = useSession();
  const { t } = useTranslation();

  const isAuthorizationEnabled =
    connection.integration_state !== 'needs_configuration' && !isReAuthorizing;

  const authorizeConnection = () => {
    handleAuthorize(onConnectionChange);
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
          connection.integration_state === 'needs_configuration' ||
          isReAuthorizing
        }
        className={`h-[58px] ${isReAuthorizing ? 'animate-pulse' : ''}`}
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
          connection.integration_state === 'needs_configuration' ||
          isReAuthorizing
        }
        className={`h-[40px] ${isReAuthorizing ? 'animate-pulse' : ''}`}
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
      isLoading={isReAuthorizing}
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
