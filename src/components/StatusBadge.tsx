import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { hasApplicableScopes } from '../utils/hasApplicableScopes';

interface Props {
  connection: Connection;
  isLoading?: boolean;
  size?: 'large' | 'small';
}

const StatusBadge = ({
  connection,
  isLoading = false,
  size = 'small',
}: Props) => {
  const { t } = useTranslation();

  const { state, integration_state, enabled, consent_state } = connection;

  const applicableScopes = hasApplicableScopes(connection);

  const statusText = () => {
    // Only show consent-related states if there are actually applicable scopes
    if (applicableScopes) {
      switch (consent_state) {
        case 'pending':
          return t('Permission required');
        case 'denied':
          return t('Permission denied');
        case 'revoked':
          return t('Permission revoked');
        case 'requires_reconsent':
          return t('New permissions required');
      }
    }

    if (integration_state === 'needs_configuration')
      return t('Needs configuration');
    if (state === 'invalid') return t('Invalid configuration');
    if (state === 'available') return t('Not connected');
    if (!enabled) return t('Disabled');
    if (state === 'added') return t('Unauthorized');
    if (state === 'authorized' && size === 'small') return t('Input required');
    if (state === 'authorized') return t('Needs configuration');
    if (state === 'callable') return t('Connected');
    return null;
  };

  const isConsentActionRequired =
    applicableScopes &&
    (consent_state === 'denied' ||
      consent_state === 'requires_reconsent' ||
      consent_state === 'revoked');

  const needsUserAttention =
    enabled &&
    (state === 'added' ||
      state === 'authorized' ||
      state === 'invalid' ||
      (applicableScopes && consent_state === 'pending'));

  const isConnected = enabled && state === 'callable';
  const isAvailableForConnection = state === 'available';

  const getStatusClass = () => {
    if (isConsentActionRequired) return 'bg-red-100 text-red-800';
    if (!enabled) return 'bg-gray-100 text-gray-800';
    if (needsUserAttention) return 'bg-yellow-100 text-yellow-800';
    if (isConnected) return 'bg-green-100 text-green-800';
    if (isAvailableForConnection) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div
      className={classNames(
        'inline-flex items-center font-medium leading-none rounded-full whitespace-nowrap',
        {
          'px-4 py-1.5 text-sm': size === 'large',
          'px-2 py-1 text-xs': size === 'small',
        },
        getStatusClass()
      )}
      data-testid="status-badge"
    >
      {isLoading && (
        <svg
          data-testid="loading-svg"
          className="h-4 w-4 animate-spin mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {statusText()}
    </div>
  );
};

export default StatusBadge;
