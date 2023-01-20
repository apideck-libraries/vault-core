import React, { Fragment, useEffect, useState } from 'react';

import { Dialog } from '@headlessui/react';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import { getApiName } from '../utils/getApiName';
import { hasMissingRequiredFields } from '../utils/hasMissingRequiredFields';
import { useConnections } from '../utils/useConnections';
import AuthorizeButton from './AuthorizeButton';
import ConnectionForm from './ConnectionForm';
import Divider from './Divider';
import LoadingDetails from './LoadingDetails';
import ResourceForm from './ResourceForm';
import ResourceList from './ResourceList';
import StatusBadge from './StatusBadge';
import TopBar from './TopBar';

interface Props {
  onClose: () => void;
  settings?: { hide_resource_settings?: boolean };
}

const ConnectionDetails = ({ onClose, settings }: Props) => {
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

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
    tag_line,
    form_fields,
    unified_api,
  } = selectedConnection;

  const hasFormFields = form_fields?.filter((field) => !field.hidden)?.length;

  const [showSettings, setShowSettings] = useState(false);
  const [showResources, setShowResources] = useState(false);

  const requiredAuthVariables =
    authorizationVariablesRequired(selectedConnection);

  const shouldShowAuthorizeButton =
    enabled &&
    state !== 'callable' &&
    auth_type === 'oauth2' &&
    !requiredAuthVariables &&
    !showSettings;

  useEffect(() => {
    // Open / close settings form bases on state
    if (
      !showSettings &&
      enabled &&
      state !== 'callable' &&
      hasFormFields &&
      (!shouldShowAuthorizeButton || state === 'authorized')
    ) {
      setShowSettings(true);
    }
  }, [enabled, state, hasFormFields]);

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

  if (selectedResource) {
    return (
      <>
        <TopBar
          onClose={onClose}
          onBack={() => setSelectedResource(null)}
          setShowSettings={setShowSettings}
          setShowResources={setShowResources}
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

  if (isLoadingDetails) return <LoadingDetails />;

  return (
    <>
      <TopBar
        onClose={onClose}
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
        settings={settings}
      />
      <div className="h-full rounded-b-xl">
        <div className="text-center p-5 md:p-6">
          <Dialog.Title
            as="h3"
            className="text-lg font-medium leading-6 text-gray-900 mb-2"
          >
            {name}
          </Dialog.Title>
          <a
            className="text-sm text-gray-700 mb-2 font-medium hover:text-gray-900"
            href={`https://developers.apideck.com/apis/${unified_api}/reference`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getApiName(selectedConnection)}
          </a>

          <p className="text-sm text-gray-500 mt-2 mb-4">{tag_line}</p>
          <div className="mx-auto">
            <StatusBadge
              connection={selectedConnection}
              isLoading={isUpdating}
              size="large"
            />
          </div>

          {shouldShowAuthorizeButton ? (
            <div className="mt-4">
              <AuthorizeButton connection={selectedConnection} />
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
              />
            </Fragment>
          ) : null}
        </div>
      </div>
    </>
  );
};
export default ConnectionDetails;
