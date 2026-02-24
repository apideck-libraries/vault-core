import { Dropdown } from '@apideck/components';
import { Option } from '@apideck/components/dist/components/Dropdown';
import classNames from 'classnames';
import React, { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REDIRECT_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings } from '../types/Session';
import { useConnectionActions } from '../utils/connectionActions';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import ConfirmModal from './ConfirmModal';

interface Props {
  onClose: () => void;
  onConnectionChange?: (connection: Connection) => any;
  onBack?: () => void;
  setShowSettings?: Dispatch<SetStateAction<boolean>>;
  setShowResources?: Dispatch<SetStateAction<boolean>>;
  hideOptions?: boolean;
  hideBackButton?: boolean;
  singleConnectionMode?: boolean;
  settings?: SessionSettings;
  setShowFieldMapping?: Dispatch<SetStateAction<boolean>>;
  currentView?: ConnectionViewType;
  setCurrentView?: Dispatch<
    SetStateAction<ConnectionViewType | undefined | null>
  >;
  showButtonLayout?: boolean;
}

const TopBar = ({
  onClose,
  onConnectionChange,
  onBack,
  hideOptions,
  hideBackButton,
  singleConnectionMode,
  settings,
  setCurrentView,
  currentView,
  showButtonLayout,
}: Props) => {
  const { selectedConnection, deleteConnection } = useConnections();
  const { session } = useSession();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { t } = useTranslation();
  const {
    isReAuthorizing,
    handleRedirect,
    handleDisable,
    handleEnable,
    isActionAllowedForSettings,
  } = useConnectionActions();

  const getOptions = () => {
    if (!selectedConnection) return [];

    const {
      state,
      enabled,
      form_fields,
      auth_type,
      oauth_grant_type,
      configurable_resources,
      authorize_url,
      revoke_url,
      custom_mappings,
    } = selectedConnection;
    const authorizeUrl = `${authorize_url}&redirect_uri=${
      session?.redirect_uri ?? REDIRECT_URL
    }`;
    const revokeUrl = `${revoke_url}&redirect_uri=${
      session?.redirect_uri ?? REDIRECT_URL
    }`;
    const options: Option[] = [];

    const isActionAllowed = isActionAllowedForSettings(settings);

    const hasFormFields = form_fields?.filter((field) => !field.hidden)?.length;

    if (currentView !== ConnectionViewType.Settings && hasFormFields) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </button>
        ),
        onClick: () => {
          if (setCurrentView) setCurrentView(ConnectionViewType.Settings);
        },
      });
    }

    if (
      (state === 'authorized' || state === 'callable') &&
      (configurable_resources ?? []).length > 0 &&
      !settings?.hide_resource_settings &&
      setCurrentView
    ) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            {t('Configurable Resources')}
          </button>
        ),
        onClick: () => {
          setCurrentView(ConnectionViewType.ConfigurableResources);
        },
      });
    }

    if (
      session?.data_scopes?.enabled &&
      (selectedConnection?.consent_state === 'implicit' ||
        selectedConnection?.consent_state === 'granted')
    ) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('Consent History')}
          </button>
        ),
        onClick: () => {
          if (setCurrentView) {
            setCurrentView(ConnectionViewType.ConsentHistory);
          }
        },
      });
    }

    if (
      custom_mappings &&
      custom_mappings?.length > 0 &&
      state === 'callable'
    ) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4 mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
            {t('Field Mapping')}
          </button>
        ),
        onClick: () => {
          if (setCurrentView) setCurrentView(ConnectionViewType.CustomMapping);
        },
      });
    }

    if (
      (state === 'authorized' || state === 'callable') &&
      (auth_type === 'oauth2' || !!oauth_grant_type) &&
      isActionAllowed('reauthorize')
    ) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={classNames('h-4 w-4 mr-2', {
                'animate-spin': isReAuthorizing,
              })}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t('Re-authorize')}
          </button>
        ),
        onClick: () => handleRedirect(authorizeUrl, onConnectionChange),
      });
    }

    if (enabled && isActionAllowed('disable')) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            {t('Disable')}
          </button>
        ),
        onClick: async () => {
          await handleDisable(setCurrentView, showButtonLayout);
        },
      });
    }

    if (!enabled && isActionAllowed('disable')) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            {t('Enable')}
          </button>
        ),
        onClick: async () => {
          await handleEnable(setCurrentView, showButtonLayout);
        },
      });
    }

    if (
      revoke_url &&
      (state === 'authorized' || state === 'callable') &&
      isActionAllowed('disconnect')
    ) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
            {t('Disconnect')}
          </button>
        ),
        onClick: () => handleRedirect(revokeUrl, onConnectionChange),
      });
    }

    if (state !== 'available' && isActionAllowed('delete')) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {t('Delete')}
          </button>
        ),
        onClick: () => {
          setShowDeleteModal(true);
        },
      });
    }

    if (!singleConnectionMode) {
      options.push({
        label: (
          <button className="flex font-medium items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4 mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {t('Close')}
          </button>
        ),
        onClick: () => onClose(),
      });
    }

    return options;
  };

  const showLogo = useMemo(
    () => selectedConnection?.icon || session?.theme?.logo,
    [selectedConnection?.icon, session?.theme?.logo]
  );

  if (!showLogo && !selectedConnection?.name) return null;

  const options = getOptions();

  return (
    <div className="grid grid-cols-3 px-6 relative" id="react-vault-top-bar">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (selectedConnection) deleteConnection(selectedConnection);
        }}
      />
      {selectedConnection &&
      !hideBackButton &&
      (!singleConnectionMode || hideOptions) ? (
        <button
          className="inline-flex mt-3 items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none"
          onClick={onBack}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
      ) : singleConnectionMode &&
        !hideBackButton &&
        options.length > 0 &&
        !showButtonLayout ? (
        <div className="flex flex-col items-start mt-3">
          <Dropdown
            trigger={
              <div
                className={classNames(
                  'inline-flex items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none',
                  { 'animation-pulse': isReAuthorizing }
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </div>
            }
            options={options}
            minWidth={0}
            align="left"
            className="font-medium z-20"
          />
        </div>
      ) : (
        <div className="w-10 m-3" />
      )}
      <div className="flex items-center justify-center flex-col">
        {showLogo ? (
          <div
            className={classNames(
              'w-20 h-20 -mt-10 ring-2 ring-white rounded-full shadow-md mx-aut bg-white ring-white ring-4 mx-auto overflow-hidden',
              { 'animate-pulse': isReAuthorizing }
            )}
          >
            <img
              src={selectedConnection?.icon ?? session?.theme?.logo}
              id="react-vault-icon"
              className="object-fit w-full h-full"
            />
          </div>
        ) : null}
        {!selectedConnection && session?.theme?.vault_name && (
          <div className="w-full mt-3 text-center text-sm font-medium text-gray-900">
            {session?.theme?.vault_name}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end mt-3">
        {selectedConnection &&
        !hideOptions &&
        !singleConnectionMode &&
        !showButtonLayout &&
        options.length > 0 ? (
          <Dropdown
            trigger={
              <div
                className={classNames(
                  'inline-flex items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none',
                  { 'animation-pulse': isReAuthorizing }
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </div>
            }
            options={options}
            minWidth={0}
            className="font-medium z-20"
            itemsClassName="!mt-0"
          />
        ) : (
          <button
            className="inline-flex  items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default TopBar;
