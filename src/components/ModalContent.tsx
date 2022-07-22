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
        className="relative -m-6 sm:rounded-lg h-full content-error"
        data-testid="error-message"
        id="react-vault-content"
      >
        <TopBar onClose={onClose} onBack={onClose} hideOptions hideBackButton />
        <div className="flex items-center text-center text-red-700 flex-col justify-center h-full p-4 m-5 rounded bg-red-100">
          <h3 className="font-medium">{error || detailsError}</h3>
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

  const noConnections =
    !addedConnections?.length && !availableConnections?.length;

  if (selectedConnection) return <ConnectionDetails onClose={onClose} />;

  return (
    <div
      className="relative -m-6 sm:rounded-lg h-full"
      id="react-vault-content"
    >
      <TopBar onClose={onClose} />
      <div className="h-full overflow-hidden rounded-b-xl">
        {addedConnections?.length > 0 && (
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
        )}
        {addedConnections?.length === 0 && availableConnections.length > 0 && (
          <div id="react-vault-connections-container">
            <div className="text-center p-5 text-lg font-medium leading-6 text-gray-900">
              <h3>Manage your integrations</h3>
            </div>
            <ConnectionsList
              isLoading={isLoading}
              connections={availableConnections}
            />
          </div>
        )}
        {noConnections && (
          <div className="text-center p-5">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              No integrations found
            </h3>
            <p className="text-gray-600 mt-2 text-base">
              It looks like the application owner did not yet make any
              integrations available
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
