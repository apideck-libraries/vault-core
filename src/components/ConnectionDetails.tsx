import React, { Fragment, useEffect, useMemo, useState } from 'react';

import { Alert, Button, usePrevious } from '@apideck/components';
import { Dialog } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings } from '../types/Session';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import { getApiName } from '../utils/getApiName';
import { hasMissingRequiredFields } from '../utils/hasMissingRequiredFields';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import AuthorizeButton from './AuthorizeButton';
import ButtonLayoutMenu from './ButtonLayoutMenu';
import ConnectionForm from './ConnectionForm';
import ConsentHistory from './ConsentHistory';
import ConsentScreen from './ConsentScreen';
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
  showConsumer?: boolean;
  initialView?: ConnectionViewType;
  showLanguageSwitch?: boolean;
  showButtonLayout?: boolean;
  autoStartAuthorization?: boolean;
}

const ConnectionDetails = ({
  onClose,
  onConnectionChange,
  settings,
  showConsumer,
  initialView,
  showLanguageSwitch,
  showButtonLayout,
  autoStartAuthorization,
}: Props) => {
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  const {
    selectedConnection,
    setSelectedConnection,
    isUpdating,
    isLoadingDetails,
    resources,
    singleConnectionMode,
    denyConsent,
  } = useConnections();

  const { session } = useSession();
  const { t } = useTranslation();

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
    (form_fields?.filter((field) => !field.hidden)?.length ?? 0) > 0;

  const [hasRequiredMappings, setHasRequiredMappings] = useState(false);
  const [currentView, setCurrentView] = useState<
    ConnectionViewType | null | undefined
  >(null);

  const requiredAuthVariables =
    authorizationVariablesRequired(selectedConnection);

  const previousState = usePrevious(selectedConnection.state);

  const shouldShowAuthorizeButton =
    enabled &&
    state !== 'callable' &&
    auth_type === 'oauth2' &&
    !requiredAuthVariables &&
    !(state === 'authorized' && hasFormFields); // Don't show authorize if already authorized with form fields - they need to configure instead

  const needsInput = useMemo(() => {
    return (
      currentView !== ConnectionViewType.Settings &&
      enabled &&
      state !== 'callable' &&
      hasFormFields &&
      (!shouldShowAuthorizeButton ||
        state === 'authorized' ||
        state === 'invalid')
    );
  }, [currentView, enabled, state, hasFormFields, shouldShowAuthorizeButton]);

  useEffect(() => {
    // Open specific view when provided as prop
    if (
      initialView &&
      (currentView === null || currentView === undefined) &&
      singleConnectionMode
    ) {
      setCurrentView(initialView);
      return;
    }

    // Open / close settings form based on state
    // Force Settings only when currentView is null/undefined (initial load) and input is needed
    // This allows manual navigation back to ButtonMenu while still auto-navigating to Settings after authorization
    if (needsInput && (currentView === null || currentView === undefined)) {
      setCurrentView(ConnectionViewType.Settings);
      return;
    }

    const justAuthorized =
      previousState !== 'authorized' && state === 'authorized';

    // Auto-navigate to Settings after authorization if form fields are needed
    // This handles the case where user just completed OAuth and needs to configure
    if (showButtonLayout && justAuthorized && hasFormFields && enabled) {
      setCurrentView(ConnectionViewType.Settings);
      return;
    }

    // Show ConfigurableResources view if specific conditions are met
    if (
      (currentView === null ||
        currentView === undefined ||
        currentView === ConnectionViewType.ButtonMenu) &&
      (selectedConnection.configurable_resources ?? []).length > 0 &&
      !settings?.hide_resource_settings &&
      hasMissingRequiredFields(resources)
    ) {
      setCurrentView(ConnectionViewType.ConfigurableResources);
      return;
    }

    // Show button menu layout when enabled and no other specific requirements
    // Handle both null and undefined (ConnectionForm sets to undefined after successful save)
    if (
      (currentView === null || currentView === undefined) &&
      showButtonLayout &&
      !needsInput &&
      selectedConnection.integration_state !== 'needs_configuration'
    ) {
      setCurrentView(ConnectionViewType.ButtonMenu);
      return;
    }

    // On single connection mode, open settings by default
    if (
      (currentView === null || currentView === undefined) &&
      singleConnectionMode
    ) {
      setCurrentView(ConnectionViewType.Settings);
    }
  }, [
    needsInput,
    initialView,
    resources,
    settings,
    selectedConnection,
    currentView,
    showButtonLayout,
    previousState,
  ]);

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
        // When using button layout, go back to ButtonMenu from other views
        if (
          showButtonLayout &&
          currentView &&
          currentView !== ConnectionViewType.ButtonMenu
        ) {
          setCurrentView(ConnectionViewType.ButtonMenu);
        } else if (singleConnectionMode) {
          // In single connection mode, if we can't go back to ButtonMenu, close the vault
          onClose();
        } else if (setSelectedConnection) {
          // In multi-connection mode, go back to connections list
          setSelectedConnection(null);
        }
      }}
      setCurrentView={setCurrentView}
      currentView={currentView}
      singleConnectionMode={singleConnectionMode}
      settings={settings}
      showButtonLayout={showButtonLayout}
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
        <div
          className={`h-full ${
            showConsumer || showLanguageSwitch ? '' : 'rounded-b-xl'
          }`}
        >
          <div className="text-center p-5 md:p-6">
            <Dialog.Title
              as="h3"
              className="text-lg font-medium leading-6 text-gray-900"
            >
              <span className="capitalize">{selectedResource}</span>{' '}
              configuration
            </Dialog.Title>
            <p className="mt-2 text-sm text-gray-500 mb-5">
              {t(
                'Please provide default values for the fields below. These will be applied when creating new {{selectedResource}} through our integration.',
                { selectedResource }
              )}
            </p>
            <ResourceForm
              resource={selectedResource}
              closeForm={() => setSelectedResource(null)}
            />
          </div>
        </div>
      </>
    );
  }

  // TODO i will put this back when done testing locally leave for now
  const statesRequiringConsent: (Connection['consent_state'] | undefined)[] = [
    'pending',
    'denied',
    'revoked',
    'requires_reconsent',
  ];
  if (
    (selectedConnection?.application_data_scopes?.enabled &&
      statesRequiringConsent.includes(selectedConnection.consent_state)) ||
    currentView === ConnectionViewType.ConsentScreen
  ) {
    return (
      <ConsentScreen
        connection={selectedConnection}
        onClose={() => setSelectedConnection(null)}
        onDeny={async (resources: any) => {
          await denyConsent(selectedConnection, resources);
          setSelectedConnection(null);
        }}
      />
    );
  }

  if (currentView === ConnectionViewType.ConsentHistory) {
    return (
      <>
        <TopBarComponent
          onBack={() =>
            showButtonLayout
              ? setCurrentView(ConnectionViewType.ButtonMenu)
              : setCurrentView(ConnectionViewType.Settings)
          }
          hideOptions={true}
        />
        <ConsentHistory
          connection={selectedConnection}
          setCurrentView={setCurrentView}
        />
      </>
    );
  }

  if (currentView === ConnectionViewType.CustomMapping) {
    return (
      <FieldMapping
        setCurrentView={setCurrentView}
        TopBarComponent={TopBarComponent}
        showConsumer={showConsumer}
        showLanguageSwitch={showLanguageSwitch}
      />
    );
  }

  if (isLoadingDetails) return <LoadingDetails />;

  // Button Layout View
  if (currentView === ConnectionViewType.ButtonMenu && showButtonLayout) {
    return (
      <>
        <TopBarComponent />
        <ButtonLayoutMenu
          connection={selectedConnection}
          onConnectionChange={onConnectionChange}
          setCurrentView={setCurrentView}
          settings={settings}
          shouldShowAuthorizeButton={shouldShowAuthorizeButton || false}
          isUpdating={isUpdating}
          showButtonLayout={showButtonLayout}
        />
      </>
    );
  }

  console.log('connection details', selectedConnection);

  return (
    <>
      <TopBarComponent
        hideOptions={
          singleConnectionMode &&
          showButtonLayout &&
          (currentView === ConnectionViewType.Settings ||
            currentView === ConnectionViewType.ConfigurableResources)
        }
      />
      <div className="h-full rounded-b-xl">
        <div className="text-center p-5 md:p-6">
          <Dialog.Title
            as="h3"
            className="text-lg font-semibold leading-6 text-gray-900 mb-1"
          >
            {name}
          </Dialog.Title>
          <a
            className="text-sm text-gray-700 mb-3 font-medium hover:text-gray-900"
            href={`https://developers.apideck.com/apis/${unified_api}/reference`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {getApiName(selectedConnection, t('Connection'))}
          </a>
          {selectedConnection.integration_state === 'needs_configuration' && (
            <Alert
              className="text-left my-2"
              description={
                <span>
                  {t('Configure the {{name}} integration in the', {
                    name,
                  })}{' '}
                  <a
                    href={`https://platform.apideck.com/configuration/${unified_api}/${service_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    Apideck admin dashboard
                  </a>{' '}
                  {t(
                    'before linking your account. This integration will not be visible to your users until configured.'
                  )}
                </span>
              }
              title={t('Admin configuration required')}
              variant="warning"
            />
          )}

          {selectedConnection.integration_state !== 'needs_configuration' && (
            <div className="mx-auto mt-3">
              <StatusBadge
                connection={selectedConnection}
                isLoading={
                  isUpdating && currentView !== ConnectionViewType.Settings
                }
                size="large"
              />
            </div>
          )}

          {selectedConnection.state === 'callable' &&
            hasRequiredMappings &&
            (currentView !== ConnectionViewType.Settings || !hasFormFields) && (
              <div className="max-w-md w-full rounded-md p-4 bg-gray-50 text-center mt-3 border border-gray-100">
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
                  {t('Missing required field mappings.')}
                </h3>
                <Button
                  className="mt-3 flex items-center w-full"
                  onClick={() =>
                    setCurrentView(ConnectionViewType.CustomMapping)
                  }
                  style={
                    session?.theme?.primary_color
                      ? { backgroundColor: session?.theme.primary_color }
                      : {}
                  }
                >
                  <span>{t('Field Mapping')}</span>
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
            <div className="mt-3">
              <AuthorizeButton
                connection={selectedConnection}
                onConnectionChange={onConnectionChange}
                autoStartAuthorization={autoStartAuthorization}
              />
            </div>
          ) : null}

          {currentView === ConnectionViewType.ConfigurableResources &&
          (selectedConnection.configurable_resources ?? []).length > 0 ? (
            <Fragment>
              <Divider text={t('Configurable resources')} />
              <ResourceList
                connection={selectedConnection}
                setSelectedResource={setSelectedResource}
              />
            </Fragment>
          ) : null}

          {hasFormFields && currentView === ConnectionViewType.Settings ? (
            <Fragment>
              {requiredAuthVariables ? (
                <div className={'mt-3 text-xs sm:text-sm text-gray-700'}>
                  {requiredAuthVariables}
                </div>
              ) : null}
              <Divider text={t('Settings')} />
              <ConnectionForm
                connection={selectedConnection}
                setCurrentView={setCurrentView}
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
