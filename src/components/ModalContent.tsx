import React, { useState } from 'react';

import { Connection } from '../types/Connection';
import ConnectionDetails from './ConnectionDetails';
import ConnectionsList from './ConnectionsList';
import { Dialog } from '@headlessui/react';
import { Dropdown } from '@apideck/components';
import SearchInput from './SearchInput';
import TabSelect from './TabSelect';
import TopBar from './TopBar';
import { useConnections } from '../utils/useConnections';

/**
 * The Modal Content component
 */
export const ModalContent = ({ onClose }) => {
  const {
    connections,
    isError,
    isLoading,
    selectedConnection,
    setSelectedConnection,
  } = useConnections();
  // const [selectedConnection, setSelectedConnection] = useState<Connection>();

  if (isError) {
    return (
      <div className="relative -m-6 bg-white sm:rounded-xl flex items-center justify-center h-full">
        {isError}
      </div>
    );
  }

  const addedConnections = connections?.filter(
    (c: Connection) => c.state !== 'available'
  );
  const availableConnections = connections?.filter(
    (c: Connection) => c.state === 'available'
  );

  return (
    <div className="relative -m-6 sm:rounded-lg h-full">
      <TopBar onClose={onClose} />
      <div className="h-full overflow-hidden rounded-b-xl">
        {selectedConnection ? (
          <ConnectionDetails />
        ) : (
          <div>
            <TabSelect
              tabs={[
                {
                  name: 'Added',
                  content: (
                    <ConnectionsList
                      isLoading={isLoading}
                      connections={addedConnections}
                    />
                  ),
                  count: addedConnections?.length,
                },
                {
                  name: 'Available',
                  content: (
                    <ConnectionsList
                      isLoading={isLoading}
                      connections={availableConnections}
                    />
                  ),
                  count: availableConnections?.length,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};
