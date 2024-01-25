import React from 'react';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings } from '../types/Session';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import ConnectionDetails from './ConnectionDetails';
import ConnectionsList from './ConnectionsList';
import ConsumerSection from './ConsumerSection';
import LoadingDetails from './LoadingDetails';
import TabSelect from './TabSelect';
import TopBar from './TopBar';

export const ModalContent = ({
  onClose,
  onConnectionChange,
  consumer,
  initialView,
}: {
  consumer?: { image?: string; user_name?: string; account_name?: string };
  onClose: () => any;
  onConnectionChange?: (connection: Connection) => any;
  initialView?: ConnectionViewType;
}) => {
  const {
    connections,
    error,
    detailsError,
    isLoading,
    selectedConnection,
    sessionExpired,
    token,
  } = useConnections();
  const { session } = useSession();
  const { t } = useTranslation();

  if ((error && !selectedConnection) || (detailsError && selectedConnection)) {
    return (
      <div
        className="relative -m-6 sm:rounded-lg h-full content-error"
        data-testid="error-message"
        id="react-vault-content"
      >
        <TopBar
          onClose={onClose}
          onConnectionChange={onConnectionChange}
          onBack={onClose}
          hideOptions
          hideBackButton
        />
        <div className="flex items-center text-center text-red-700 flex-col justify-center h-full p-4 m-5 rounded bg-red-100">
          <h3 className="font-medium">
            {!token ? 'No valid session.' : detailsError || error}
          </h3>
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
  const showConsumer =
    hasConsumerMetadata && !session?.settings?.hide_consumer_card;

  if (selectedConnection)
    return (
      <div
        className="relative -m-6 sm:rounded-lg h-full fade-up"
        id="react-vault-content"
      >
        <ConnectionDetails
          onClose={onClose}
          onConnectionChange={onConnectionChange}
          settings={session?.settings as SessionSettings}
          showConsumer={showConsumer}
          data-testid={`details-${selectedConnection.id}`}
          initialView={initialView}
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
      <TopBar
        onConnectionChange={onConnectionChange}
        onClose={onClose}
        settings={session?.settings as SessionSettings}
      />
      <div
        className={`h-full overflow-hidden min-h-[469px] ${
          showConsumer ? '' : 'rounded-b-lg'
        }`}
      >
        {addedConnections?.length > 0 && (
          <TabSelect
            tabs={[
              {
                name: `${t('Added')}`,
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
                name: `${t('Available')}`,
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
              <h3>{t('Manage your integrations')}</h3>
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
              {t('No integrations found')}
            </h3>
            <p className="text-gray-600 mt-2 text-base">
              {t('No integrations have been added yet')}
            </p>
          </div>
        )}
      </div>
      {showConsumer && <ConsumerSection consumer={consumer} />}
    </div>
  );
};
