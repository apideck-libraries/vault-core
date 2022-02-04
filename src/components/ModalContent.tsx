import { Connection } from '../types/Connection';
import ConnectionDetails from './ConnectionDetails';
import ConnectionsList from './ConnectionsList';
import React from 'react';
import TabSelect from './TabSelect';
import TopBar from './TopBar';
import { useConnections } from '../utils/useConnections';

export const ModalContent = ({ onClose }: { onClose: () => any }) => {
  const { connections, error, isLoading, selectedConnection } =
    useConnections();

  if (error) {
    return (
      <div className="relative bg-white sm:rounded-xl flex items-center justify-center h-full">
        {error}
      </div>
    );
  }

  const addedConnections = connections?.filter(
    (c: Connection) => c.state !== 'available'
  );
  const availableConnections = connections?.filter(
    (c: Connection) => c.state === 'available'
  );

  if (selectedConnection) return <ConnectionDetails onClose={onClose} />;

  return (
    <div className="relative -m-6 sm:rounded-lg h-full">
      <TopBar onClose={onClose} />
      <div className="h-full overflow-hidden rounded-b-xl">
        <TabSelect
          tabs={[
            {
              name: 'Connected',
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
    </div>
  );
};
