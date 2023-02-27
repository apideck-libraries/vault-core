import { Connection } from '../types/Connection';
import React from 'react';
import classNames from 'classnames';

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
  const { state, integration_state, enabled } = connection;

  const statusText = () => {
    if (integration_state === 'needs_configuration')
      return 'Needs configuration';
    if (state === 'available') return 'Not connected';
    if (!enabled) return 'Disabled';
    if (state === 'added') return 'Unauthorized';
    if (state === 'authorized' && size === 'small') return 'Input required';
    if (state === 'authorized') return 'Needs configuration';
    if (state === 'callable') return 'Connected';
    return null;
  };

  return (
    <div
      className={classNames(
        'inline-flex items-center font-medium leading-none rounded-full whitespace-nowrap',
        {
          'px-4 py-1.5 text-sm': size === 'large',
          'px-2 py-1 text-xs': size === 'small',
          'bg-gray-100 text-gray-800': !enabled,
          'bg-yellow-100 text-yellow-800':
            enabled && (state === 'added' || state === 'authorized'),
          'bg-green-100 text-green-800': enabled && state === 'callable',
          'bg-red-100 text-red-800': state === 'available',
        }
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
