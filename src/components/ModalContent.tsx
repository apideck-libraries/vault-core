import React from 'react';
import { Connection } from '../types/Connection';
import { useConnections } from '../utils/useConnections';
import ConnectionDetails from './ConnectionDetails';
import ConnectionsList from './ConnectionsList';
import ConsumerSection from './ConsumerSection';
import LoadingDetails from './LoadingDetails';
import TabSelect from './TabSelect';
import TopBar from './TopBar';

export const ModalContent = ({
  onClose,
  settings,
  consumer,
  theme,
}: {
  onClose: () => any;
  settings?: { hide_resource_settings?: boolean; hide_consumer_card?: boolean };
  consumer?: { image?: string; user_name?: string; account_name?: string };
  theme?: { logo: string };
}) => {
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
        <TopBar
          onClose={onClose}
          onBack={onClose}
          theme={theme}
          hideOptions
          hideBackButton
        />
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
  const hasConsumerMetadata = consumer && Object.keys(consumer).length > 0;
  const showConsumer = hasConsumerMetadata && !settings?.hide_consumer_card;

  if (selectedConnection)
    return (
      <div
        className="relative -m-6 sm:rounded-lg h-full fade-up"
        id="react-vault-content"
      >
        <ConnectionDetails
          onClose={onClose}
          settings={settings}
          data-testid={`details-${selectedConnection.id}`}
        />
        {showConsumer && <ConsumerSection consumer={consumer} />}
      </div>
    );

  if (isLoading && noConnections) return <LoadingDetails />;

  return (
    <div
      className="relative -m-6 sm:rounded-lg h-full"
      id="react-vault-content"
    >
      <TopBar onClose={onClose} settings={settings} theme={theme} />
      <div
        className={`h-full overflow-hidden ${
          showConsumer ? '' : 'rounded-b-lg'
        }`}
      >
        {addedConnections?.length > 0 && (
          <TabSelect
            tabs={[
              {
                name: 'Added',
                content: (
                  <ConnectionsList
                    isLoading={isLoading}
                    connections={addedConnections}
                    type="added"
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
                    type="available"
                  />
                ),
                count: availableConnections?.length,
              },
            ]}
          />
        )}
        {addedConnections?.length === 0 && availableConnections.length > 0 && (
          <div id="react-vault-connections-container">
            <div
              className={`text-center text-lg font-medium leading-6 text-gray-900 ${'p-6'}`}
            >
              <h3>Manage your integrations</h3>
            </div>
            <ConnectionsList
              isLoading={isLoading}
              connections={availableConnections}
              type="available"
            />
          </div>
        )}
        {!isLoading && noConnections && (
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
      {showConsumer && <ConsumerSection consumer={consumer} />}
    </div>
  );
};
