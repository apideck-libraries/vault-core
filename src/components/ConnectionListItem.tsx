import React, { useState } from 'react';

import { APIS } from '../constants/apis';
import { Connection } from '../types/Connection';
import { Status } from './Status';
import classNames from 'classnames';
import { useConnections } from '../utils/useConnections';

interface Props {
  connection: Connection;
}

const ConnectionListItem = ({ connection }: Props) => {
  const { updateConnection, setSelectedConnection } = useConnections();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setSelectedConnection(connection);
    return;
    setIsLoading(true);
    try {
      const result = await updateConnection(
        connection.unified_api,
        connection.service_id,
        {
          enabled: true,
        }
      );

      if (result.data) setSelectedConnection(result.data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <li
      key={connection.id}
      className="bg-white cursor-pointer"
      onClick={handleClick}
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
                {APIS?.find((api) => api.id === connection.unified_api)?.name}
              </p>
            </div>
            <Status connection={connection} />
          </div>
        </div>
      </div>
    </li>
  );
};

export default ConnectionListItem;
