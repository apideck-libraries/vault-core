import { Connection } from '../types/Connection';
import ConnectionListItem from './ConnectionListItem';
import React from 'react';

const ConnectionsList = ({ connections, isLoading }) => {
  return (
    <ul role="list" className="relative z-0 divide-y divide-gray-200 ">
      {isLoading
        ? [0, 1, 2, 3, 4, 5]?.map((index) => {
            return (
              <li key={index} className="bg-white animate-pulse">
                <div className="relative px-6 py-5 flex items-center space-x-3 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div>
                      <p className="w-20 bg-gray-200 h-3 rounded-sm"></p>
                      <p className="bg-gray-200 w-8 h-2 mt-2 rounded-sm"></p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })
        : connections?.map((connection: Connection) => {
            return (
              <ConnectionListItem connection={connection} key={connection.id} />
            );
          })}
    </ul>
  );
};

export default ConnectionsList;
