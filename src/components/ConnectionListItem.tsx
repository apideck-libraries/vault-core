import React, { useState } from 'react';

import { Connection } from '../types/Connection';
import StatusBadge from './StatusBadge';
import classNames from 'classnames';
import { getApiName } from '../utils/getApiName';
import { useConnections } from '../utils/useConnections';

interface Props {
  connection: Connection;
}

const ConnectionListItem = ({ connection }: Props) => {
  const { updateConnection, setSelectedConnection } = useConnections();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (connection.state === 'available') {
      setIsLoading(true);
      const result = await updateConnection(
        connection.unified_api,
        connection.service_id,
        { enabled: true }
      );
      setIsLoading(false);
      if (result?.data) {
        setSelectedConnection(result.data);
      }
    } else {
      setSelectedConnection(connection);
    }
  };

  return (
    <li
      key={connection.id}
      className="bg-white cursor-pointer fade-in"
      onClick={handleClick}
      id={`react-vault-connection-${connection.id}`}
      data-testid={connection.id}
    >
      <div
        className={classNames(
          'relative px-6 py-5 flex items-center space-x-3 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500',
          { 'animate-pulse': isLoading }
        )}
      >
        <div className="flex-shrink-0">
          <img
            className={classNames('h-10 w-10 rounded-full', {
              grayscale: isLoading,
            })}
            src={connection.icon}
            alt={connection.name}
          />
        </div>
        <div className="flex-1 min-w-0 flex-col">
          <div className="flex items-center justify-between">
            <div className="focus:outline-none">
              <span className="absolute inset-0" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">
                {connection.name}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {getApiName(connection)}
              </p>
            </div>
            {isLoading ? (
              <svg
                data-testid="loading-svg"
                className="h-4 w-4 animate-spin"
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
            ) : (
              connection.state !== 'callable' &&
              connection.state !== 'available' && (
                <StatusBadge connection={connection} size="small" />
              )
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ConnectionListItem;
