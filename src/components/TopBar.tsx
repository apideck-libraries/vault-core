import { Dropdown } from '@apideck/components';
import React from 'react';
import classNames from 'classnames';
import { useConnections } from '../utils/useConnections';

const TopBar = ({ onClose }) => {
  const {
    isUpdating,
    selectedConnection,
    setSelectedConnection,
    updateConnection,
    deleteConnection,
  } = useConnections();

  const getOptions = () => {
    const { state, enabled, unified_api, service_id } = selectedConnection;
    const options = [];

    if (state === 'authorized' || state === 'callable') {
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Re-authorize
          </button>
        ),
        onClick: () => console.log('Lets Re-Authorize'),
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
          const result = await updateConnection(unified_api, service_id, {
            enabled: false,
          });
          if (result.status === 'success') {
            console.log('Updated');
          }
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
        onClick: () =>
          updateConnection(unified_api, service_id, { enabled: true }),
      });
    }

    if (state === 'authorized' || state === 'callable') {
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
        onClick: () => console.log('Lets disconnect'),
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
        onClick: () => deleteConnection(selectedConnection),
      });
    }

    return options;
  };

  return (
    <div className="grid grid-cols-3 px-6">
      {selectedConnection ? (
        <button
          className="inline-flex mt-3 items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none"
          onClick={() => setSelectedConnection(null)}
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
      ) : (
        <div className="w-10 m-3" />
      )}
      <img
        src={selectedConnection?.icon ?? 'https://www.apideck.com/favicon.ico'}
        className={classNames(
          'w-20 h-20 -mt-8 rounded-full shadow-md mx-aut bg-white ring-white ring-4 mx-auto',
          { 'animate-pulse': isUpdating }
        )}
      />
      <div className="flex flex-col items-end mt-3">
        {selectedConnection ? (
          <Dropdown
            trigger={
              <button
                className="inline-flex items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none"
                onClick={() => console.log('Lets do something')}
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
              </button>
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
