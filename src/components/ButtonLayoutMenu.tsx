import { Button } from '@apideck/components';
import { Dialog } from '@headlessui/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REDIRECT_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings } from '../types/Session';
import { useConnectionActions } from '../utils/connectionActions';
import { getApiName } from '../utils/getApiName';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import ConfirmModal from './ConfirmModal';
import Divider from './Divider';
import StatusBadge from './StatusBadge';

interface ButtonOption {
  label: string;
  icon: JSX.Element;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline';
}

interface Props {
  connection: Connection;
  onConnectionChange?: (connection: Connection) => any;
  setCurrentView: (view: ConnectionViewType | null | undefined) => void;
  settings: SessionSettings;
  shouldShowAuthorizeButton: boolean;
  isUpdating: boolean;
  showButtonLayout?: boolean;
}

const ButtonLayoutMenu: React.FC<Props> = ({
  connection,
  onConnectionChange,
  setCurrentView,
  settings,
  shouldShowAuthorizeButton,
  isUpdating,
  showButtonLayout,
}) => {
  const { session } = useSession();
  const { t } = useTranslation();
  const {
    isReAuthorizing,
    handleRedirect,
    handleDisable,
    handleEnable,
    isActionAllowedForSettings,
  } = useConnectionActions();
  const { deleteConnection } = useConnections();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getButtonOptions = (): ButtonOption[] => {
    const {
      state,
      enabled,
      form_fields,
      auth_type,
      configurable_resources,
      custom_mappings,
      authorize_url,
      revoke_url,
    } = connection;

    const buttons: ButtonOption[] = [];
    const hasFormFields =
      form_fields?.filter((field) => !field.hidden)?.length > 0;

    const isActionAllowed = isActionAllowedForSettings(settings);

    // Authorization button as first action if needed
    if (shouldShowAuthorizeButton) {
      buttons.push({
        label: t('Authorize'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        onClick: async () => {
          const authorizeUrl = `${authorize_url}&redirect_uri=${
            session?.redirect_uri ?? REDIRECT_URL
          }`;
          await handleRedirect(authorizeUrl, onConnectionChange);
        },
        variant: 'primary',
      });
    }

    if (!enabled && isActionAllowed('disable')) {
      buttons.push({
        label: t('Enable'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: async () => {
          await handleEnable(setCurrentView, showButtonLayout);
        },
        variant: !shouldShowAuthorizeButton ? 'primary' : 'outline',
      });
    }

    // Settings button - match TopBar logic exactly
    if (hasFormFields) {
      buttons.push({
        label: t('Settings'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: () => setCurrentView(ConnectionViewType.Settings),
        variant: 'outline',
      });
    }

    // Configurable Resources button
    if (
      (state === 'authorized' || state === 'callable') &&
      (configurable_resources ?? []).length > 0 &&
      !settings?.hide_resource_settings
    ) {
      buttons.push({
        label: t('Resources'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: () => setCurrentView(ConnectionViewType.ConfigurableResources),
        variant: 'outline',
      });
    }

    // Consent History button
    if (
      session?.data_scopes?.enabled &&
      (connection.consent_state === 'implicit' ||
        connection.consent_state === 'granted')
    ) {
      buttons.push({
        label: t('Consent History'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: () => setCurrentView(ConnectionViewType.ConsentHistory),
        variant: 'outline',
      });
    }

    // Field Mapping button
    if (custom_mappings?.length > 0 && state === 'callable') {
      buttons.push({
        label: t('Field Mapping'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
        ),
        onClick: () => setCurrentView(ConnectionViewType.CustomMapping),
        variant: 'outline',
      });
    }

    // Re-authorize button
    if (
      (state === 'authorized' || state === 'callable') &&
      auth_type === 'oauth2' &&
      isActionAllowed('reauthorize')
    ) {
      buttons.push({
        label: t('Re-authorize'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: async () => {
          const authorizeUrl = `${authorize_url}&redirect_uri=${
            session?.redirect_uri ?? REDIRECT_URL
          }`;
          await handleRedirect(authorizeUrl, onConnectionChange);
        },
        variant: 'outline',
      });
    }

    // Enable/Disable button - use shared logic
    if (enabled && isActionAllowed('disable')) {
      buttons.push({
        label: t('Disable'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: async () => {
          await handleDisable(setCurrentView, showButtonLayout);
        },
        variant: 'outline',
      });
    }

    // Disconnect button - use shared logic
    if (
      revoke_url &&
      (state === 'authorized' || state === 'callable') &&
      isActionAllowed('disconnect')
    ) {
      buttons.push({
        label: t('Disconnect'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: async () => {
          const revokeUrl = `${revoke_url}&redirect_uri=${
            session?.redirect_uri ?? REDIRECT_URL
          }`;
          await handleRedirect(revokeUrl, onConnectionChange);
        },
        variant: 'outline',
      });
    }

    // Delete button - use confirmation modal like TopBar
    if (state !== 'available' && isActionAllowed('delete')) {
      buttons.push({
        label: t('Delete'),
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        ),
        onClick: () => {
          setShowDeleteModal(true);
        },
        variant: 'outline',
      });
    }

    return buttons;
  };

  const buttonOptions = getButtonOptions();

  return (
    <div className="h-full rounded-b-xl">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          deleteConnection(connection);
          setShowDeleteModal(false);
        }}
      />
      <div className="text-center p-5 md:p-6">
        <Dialog.Title
          as="h3"
          className="text-lg font-medium leading-6 text-gray-900 mb-1"
        >
          {connection.name}
        </Dialog.Title>
        <a
          className="text-sm text-gray-700 mb-4 font-medium hover:text-gray-900"
          href={`https://developers.apideck.com/apis/${connection.unified_api}/reference`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {getApiName(connection, t('Connection'))}
        </a>

        <div className="mx-auto mt-3">
          <StatusBadge
            connection={connection}
            isLoading={isUpdating || isReAuthorizing}
            size="large"
          />
        </div>

        {buttonOptions.length > 0 && (
          <div className="mt-3">
            <Divider text={t('Actions')} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              {buttonOptions.map((button, index) => (
                <Button
                  key={index}
                  className="flex items-center justify-center p-3 text-sm"
                  variant={button.variant}
                  onClick={button.onClick}
                  disabled={isReAuthorizing}
                >
                  <div className="mr-2">{button.icon}</div>
                  {button.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ButtonLayoutMenu;
