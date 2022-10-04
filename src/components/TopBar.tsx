import React, { Dispatch, SetStateAction, useState } from 'react';

import ConfirmModal from './ConfirmModal';
import { Dropdown } from '@apideck/components';
import { FormField } from '../types/FormField';
import { Option } from '@apideck/components/dist/components/Dropdown';
import { REDIRECT_URL } from '../constants/urls';
import classNames from 'classnames';
import { useConnections } from '../utils/useConnections';
import { useSWRConfig } from 'swr';

interface Props {
  onClose: () => void;
  onBack?: () => void;
  setShowSettings?: Dispatch<SetStateAction<boolean>>;
  setShowResources?: Dispatch<SetStateAction<boolean>>;
  hideOptions?: boolean;
  hideBackButton?: boolean;
  singleConnectionMode?: boolean;
}

const TopBar = ({
  onClose,
  onBack,
  setShowSettings,
  setShowResources,
  hideOptions,
  hideBackButton,
  singleConnectionMode,
}: Props) => {
  const {
    selectedConnection,
    updateConnection,
    deleteConnection,
    connectionsUrl,
  } = useConnections();
  const [isReAuthorizing, setIsReAuthorizing] = useState(false);
  const { mutate } = useSWRConfig();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleRedirect = (url: string) => {
    setIsReAuthorizing(true);
    const child = window.open(
      url,
      '_blank',
      'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
    );
    const timer = setInterval(checkChild, 500);
    function checkChild() {
      if (child?.closed) {
        clearInterval(timer);
        mutate(
          `${connectionsUrl}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`
        );
        setIsReAuthorizing(false);
      }
    }
  };

  const getOptions = () => {
    if (!selectedConnection) return [];

    const {
      state,
      enabled,
      unified_api,
      service_id,
      form_fields,
      auth_type,
      configurable_resources,
      authorize_url,
      revoke_url,
    } = selectedConnection;
    const authorizeUrl = `${authorize_url}&redirect_uri=${REDIRECT_URL}`;
    const revokeUrl = `${revoke_url}&redirect_uri=${REDIRECT_URL}`;
    const options: Option[] = [];

    const hasFormFields = form_fields?.filter((field) => !field.hidden)?.length;

    if (hasFormFields) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
          if (setShowSettings) setShowSettings(true);
          if (setShowResources) setShowResources(false);
        },
      });
    }

    if (
      (state === 'authorized' || state === 'callable') &&
      configurable_resources?.length
    ) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Configurable Resources
          </button>
        ),
        onClick: () => {
          if (setShowResources) setShowResources(true);
          if (setShowSettings) setShowSettings(false);
        },
      });
    }

    if (
      (state === 'authorized' || state === 'callable') &&
      auth_type === 'oauth2'
    ) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Re-authorize
          </button>
        ),
        onClick: () => handleRedirect(authorizeUrl),
      });
    }

    if (enabled) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Disable
          </button>
        ),
        onClick: async () => {
          if (setShowSettings) setShowSettings(false);
          updateConnection(unified_api, service_id, {
            enabled: false,
          });
        },
      });
    }

    if (!enabled) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Enable
          </button>
        ),
        onClick: async () => {
          const result = await updateConnection(unified_api, service_id, {
            enabled: true,
          });
          if (result?.data) {
            const { state, form_fields } = result.data;
            const hasFormFields = form_fields?.filter(
              (field: FormField) => !field.hidden
            )?.length;
            if (state !== 'callable' && hasFormFields && setShowSettings) {
              setShowSettings(true);
            }
          }
        },
      });
    }

    if (revoke_url && (state === 'authorized' || state === 'callable')) {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Disconnect
          </button>
        ),
        onClick: () => handleRedirect(revokeUrl),
      });
    }

    if (state !== 'available') {
      options.push({
        label: (
          <button className="px-1 flex font-medium items-center">
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
            Delete
          </button>
        ),
        onClick: () => {
          setShowDeleteModal(true);
        },
      });
    }

    return options;
  };

  return (
    <div className="grid grid-cols-3 px-6 relative" id="react-vault-top-bar">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (selectedConnection) deleteConnection(selectedConnection);
        }}
      />
      {selectedConnection && !hideBackButton && !singleConnectionMode ? (
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
      ) : singleConnectionMode && !hideBackButton ? (
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
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </div>
            }
            options={getOptions()}
            minWidth={0}
            align="left"
            className="font-medium"
          />
        </div>
      ) : (
        <div className="w-10 m-3" />
      )}
      <img
        src={selectedConnection?.icon ?? 'https://www.apideck.com/favicon.ico'}
        id="react-vault-icon"
        className={classNames(
          'w-20 h-20 -mt-8 rounded-full shadow-md mx-aut bg-white ring-white ring-4 mx-auto',
          { 'animate-pulse': isReAuthorizing }
        )}
      />
      <div className="flex flex-col items-end mt-3">
        {selectedConnection && !hideOptions && !singleConnectionMode ? (
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
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </div>
            }
            options={getOptions()}
            minWidth={0}
            className="font-medium"
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
