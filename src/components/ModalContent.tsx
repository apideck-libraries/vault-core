import { Connection } from '../types/Connection';
import ConnectionDetails from './ConnectionDetails';
import ConnectionsList from './ConnectionsList';
import React from 'react';
import TabSelect from './TabSelect';
import TopBar from './TopBar';
import { useConnections } from '../utils/useConnections';

export const ModalContent = ({ onClose }: { onClose: () => any }) => {
  const {
    connections,
    error,
    detailsError,
    isLoading,
    selectedConnection,
    sessionExpired,
  } = useConnections();

  if ((error && !selectedConnection) || (detailsError && selectedConnection)) {
    return (
      <div
        className="relative -m-6 sm:rounded-lg h-full"
        data-testid="error-message"
      >
        <TopBar onClose={onClose} onBack={onClose} hideOptions hideBackButton />
        <div className="flex items-center text-center text-red-700 flex-col justify-center h-full p-4 m-5 rounded bg-red-100">
          <h3 className="font-medium">{error}</h3>
          {sessionExpired ? (
            <p className="text-sm font-base mt-1">
              Your session is invalid or has been expired
            </p>
          ) : null}
        </div>
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
        {addedConnections?.length ? (
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
        ) : (
          <div>
            <div className="text-center p-5 text-lg font-medium leading-6 text-gray-900">
              <h3>Manage your integrations</h3>
            </div>
            <ConnectionsList
              isLoading={isLoading}
              connections={availableConnections}
            />
          </div>
        )}
      </div>
    </div>
  );
};
