import React, { Fragment, useEffect, useState } from 'react';

import { Alert, Button } from '@apideck/components';
import { Dialog } from '@headlessui/react';
import { Connection } from '../types/Connection';
import { SessionSettings } from '../types/Session';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import { getApiName } from '../utils/getApiName';
import { hasMissingRequiredFields } from '../utils/hasMissingRequiredFields';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
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

  const { session } = useSession();
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
  const [hasRequiredMappings, setHasRequiredMappings] = useState(false);

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

  useEffect(() => {
    let hasRequiredMappings = false;
    selectedConnection.custom_mappings?.forEach((mapping) => {
      if (mapping.required && !mapping.value) {
        hasRequiredMappings = true;
      }
    });
    setHasRequiredMappings(hasRequiredMappings);
  }, [selectedConnection]);

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
      <FieldMapping
        setShowFieldMapping={setShowFieldMapping}
        TopBarComponent={TopBarComponent}
      />
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

          {selectedConnection.state === 'callable' && hasRequiredMappings && (
            <div className="max-w-md w-full rounded-md p-4 bg-gray-50 text-center mt-4 border border-gray-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 mx-auto text-gray-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>

              <h3
                data-testid="alert-title"
                className="mt-2 text-sm font-medium text-gray-800 dark:text-white"
              >
                Missing required field mappings.
              </h3>
              <Button
                // size="small"
                className="mt-3 flex items-center w-full"
                onClick={() => setShowFieldMapping(true)}
                style={
                  session?.theme?.primary_color
                    ? { backgroundColor: session?.theme.primary_color }
                    : {}
                }
              >
                <span>Field Mapping</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 ml-2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Button>
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
