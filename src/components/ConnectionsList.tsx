import React, { ChangeEvent, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';
import Fuse from 'fuse.js';
import { Connection } from '../types/Connection';
import useDebounce from '../utils/useDebounce';
import ConnectionListItem from './ConnectionListItem';
import SearchInput from './SearchInput';

interface Props {
  connections: Connection[];
  isLoading: boolean;
}

const ConnectionsList = ({ connections, isLoading }: Props) => {
  const showSearch = !isLoading && connections?.length > 5;

  const [searchTerm, setSearchTerm] = useState('');
  const [list, setList] = useState<Connection[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const searchInputRef: any = useRef();

  useEffect(() => {
    if (showSearch && debouncedSearchTerm) {
      const fuse = new Fuse(connections, {
        keys: ['name', 'unified_api'],
        threshold: 0.4,
      });
      const results = fuse.search(debouncedSearchTerm);
      const connectionResults = results.map((result) => result.item);

      setList(connectionResults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const connectionsToShow = searchTerm.length ? list : connections;

  return (
    <div
      className="border-b border-gray-100 overflow-y-auto h-full"
      style={{ maxHeight: 488 }}
    >
      {showSearch ? (
        <SearchInput
          value={searchTerm}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(event.target.value)
          }
          searchInputRef={searchInputRef}
        />
      ) : null}
      <ul
        role="list"
        id="react-vault-connection-list"
        className={classNames(
          'relative z-0 divide-y divide-gray-100 border-b border-gray-100',
          { 'border-t': showSearch }
        )}
      >
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
          : connectionsToShow?.map((connection: Connection) => {
              return (
                <ConnectionListItem
                  connection={connection}
                  key={connection.id}
                />
              );
            })}
      </ul>
    </div>
  );
};

export default ConnectionsList;
