import React, { Fragment, useEffect, useState } from 'react';

import { Alert } from '@apideck/components';
import { Dialog } from '@headlessui/react';
import { Connection } from '../types/Connection';
import { SessionSettings } from '../types/Session';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import { getApiName } from '../utils/getApiName';
import { hasMissingRequiredFields } from '../utils/hasMissingRequiredFields';
import { useConnections } from '../utils/useConnections';
import AuthorizeButton from './AuthorizeButton';
import ConnectionForm from './ConnectionForm';
import Divider from './Divider';
import FieldMapping from './FieldMapping';
import LoadingDetails from './LoadingDetails';
import ResourceForm from './ResourceForm';
import ResourceList from './ResourceList';
import StatusBadge from './StatusBadge';
import TopBar from './TopBar';

interface Props {
  onClose: () => void;
  onConnectionChange?: (connection: Connection) => any;
  settings: SessionSettings;
}

const ConnectionDetails = ({
  onClose,
  onConnectionChange,
  settings,
}: Props) => {
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [showFieldMapping, setShowFieldMapping] = useState<boolean | null>(
    false
  );

  const {
    selectedConnection,
    setSelectedConnection,
    isUpdating,
    isLoadingDetails,
    resources,
    singleConnectionMode,
  } = useConnections();
  if (!selectedConnection) return null;

  const {
    enabled,
    state,
    auth_type,
    name,
    form_fields,
    unified_api,
    service_id,
  } = selectedConnection;

  const hasFormFields =
    form_fields?.filter((field) => !field.hidden)?.length > 0;

  const [showSettings, setShowSettings] = useState(false);
  const [showResources, setShowResources] = useState(false);

  const requiredAuthVariables =
    authorizationVariablesRequired(selectedConnection);

  const shouldShowAuthorizeButton =
    enabled &&
    state !== 'callable' &&
    auth_type === 'oauth2' &&
    !requiredAuthVariables;

  useEffect(() => {
    // Open / close settings form bases on state
    const needsInput =
      !showSettings &&
      enabled &&
      state !== 'callable' &&
      hasFormFields &&
      (!shouldShowAuthorizeButton ||
        state === 'authorized' ||
        state === 'invalid');

    if (needsInput || singleConnectionMode) {
      setShowSettings(true);
    }
  }, [state, hasFormFields]);

  useEffect(() => {
    // Open / close resource form bases on missing fields
    if (
      !showSettings &&
      hasMissingRequiredFields(resources) &&
      !settings?.hide_resource_settings
    ) {
      setShowResources(true);
    }

    if (showResources && !hasMissingRequiredFields(resources)) {
      setShowResources(false);
    }
  }, [selectedConnection, resources, showSettings]);

  const TopBarComponent = (props) => (
    <TopBar
      onClose={onClose}
      onConnectionChange={onConnectionChange}
      onBack={() => {
        if (singleConnectionMode) {
          onClose();
        } else if (setSelectedConnection) {
          setSelectedConnection(null);
        }
      }}
      setShowSettings={setShowSettings}
      setShowResources={setShowResources}
      singleConnectionMode={singleConnectionMode}
      setShowFieldMapping={setShowFieldMapping}
      settings={settings}
      {...props}
    />
  );

  if (selectedResource) {
    return (
      <>
        <TopBarComponent
          onBack={() => setSelectedResource(null)}
          hideOptions={true}
        />
        <div className="h-full rounded-b-xl">
          <div className="text-center p-5 md:p-6">
            <Dialog.Title
              as="h3"
              className="text-lg font-medium leading-6 text-gray-900"
            >
              <span className="capitalize">{selectedResource}</span>{' '}
              configuration
            </Dialog.Title>
            <p className="mt-2 text-sm text-gray-500 mb-5">{`
                Please provide default values for the fields below. These will be
                applied when creating new ${selectedResource} through our integration.`}</p>
            <ResourceForm
              resource={selectedResource}
              closeForm={() => setSelectedResource(null)}
            />
          </div>
        </div>
      </>
    );
  }

  if (showFieldMapping) {
    return (
      <>
        <TopBarComponent
          onBack={() => setShowFieldMapping(null)}
          hideOptions={true}
        />
        <FieldMapping resources={resources} />
      </>
    );
  }

  if (isLoadingDetails) return <LoadingDetails />;

  return (
    <>
      <TopBarComponent />
      <div className="h-full rounded-b-xl">
        <div className="text-center p-5 md:p-6">
          <Dialog.Title
            as="h3"
            className="text-lg font-medium leading-6 text-gray-900 mb-2"
          >
            {name}
          </Dialog.Title>
          <a
            className="text-sm text-gray-700 mb-4 font-medium hover:text-gray-900"
            href={`https://developers.apideck.com/apis/${unified_api}/reference`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getApiName(selectedConnection)}
          </a>
          {selectedConnection.integration_state === 'needs_configuration' && (
            <Alert
              className="text-left my-2"
              description={
                <span>
                  Configure the {name} integration in the{' '}
                  <a
                    href={`https://platform.apideck.com/configuration/${unified_api}/${service_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    Apideck admin dashboard
                  </a>{' '}
                  before linking your account. This integration will not be
                  visible to your users until configured.
                </span>
              }
              title="Admin configuration required"
              variant="warning"
            />
          )}

          {selectedConnection.integration_state !== 'needs_configuration' && (
            <div className="mx-auto mt-4">
              <StatusBadge
                connection={selectedConnection}
                isLoading={isUpdating && !showSettings}
                size="large"
              />
            </div>
          )}

          {shouldShowAuthorizeButton ? (
            <div className="mt-4">
              <AuthorizeButton
                connection={selectedConnection}
                onConnectionChange={onConnectionChange}
              />
            </div>
          ) : null}

          {showResources ? (
            <Fragment>
              <Divider text="Configurable resources" />
              <ResourceList
                connection={selectedConnection}
                setSelectedResource={setSelectedResource}
              />
            </Fragment>
          ) : null}

          {hasFormFields && showSettings ? (
            <Fragment>
              {requiredAuthVariables ? (
                <div className={'mt-4 text-xs sm:text-sm text-gray-700'}>
                  {requiredAuthVariables}
                </div>
              ) : null}
              <Divider text="Settings" />
              <ConnectionForm
                connection={selectedConnection}
                setShowSettings={setShowSettings}
                settings={settings}
              />
            </Fragment>
          ) : null}
        </div>
      </div>
    </>
  );
};
export default ConnectionDetails;
