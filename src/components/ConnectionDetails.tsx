import React, { Fragment, useState } from 'react';

import AuthorizeButton from './AuthorizeButton';
import { Button } from '@apideck/components';
import ConnectionForm from './ConnectionForm';
import { Dialog } from '@headlessui/react';
import StatusBadge from './StatusBadge';
import TopBar from './TopBar';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import classNames from 'classnames';
import { useConnections } from '../utils/useConnections';

const ConnectionDetails = ({ onClose }) => {
  const { selectedConnection, isUpdating } = useConnections();
  if (!selectedConnection) return null;

  const { state, auth_type, authorize_url, name, tag_line, form_fields } =
    selectedConnection;

  const [showSettings, setShowSettings] = useState(state !== 'callable');

  const requiredAuth = authorizationVariablesRequired(selectedConnection);

  const shouldShowAuthorizeButton =
    state !== 'callable' && auth_type === 'oauth2' && !requiredAuth;

  const hasFormFields = form_fields?.filter((field) => !field.hidden)?.length;

  return (
    <div className="relative -m-6 sm:rounded-lg h-full">
      <TopBar onClose={onClose} setShowSettings={setShowSettings} />
      <div className="h-full overflow-hidden rounded-b-xl">
        <div
          className={classNames('text-center p-5 md:p-6', {
            'animate-pulse': isUpdating,
          })}
        >
          <Dialog.Title
            as="h3"
            className="text-lg font-medium leading-6 text-gray-900"
          >
            {name}
          </Dialog.Title>

          <div>
            <div className="my-2">
              <p className="text-sm text-gray-500">{tag_line}</p>
              <div className="mx-auto mt-4">
                <StatusBadge
                  connection={selectedConnection}
                  isLoading={isUpdating}
                  size="large"
                />
              </div>
            </div>
            {requiredAuth ? (
              <div className={'font-medium text-xs sm:text-sm text-gray-500'}>
                {requiredAuth}
              </div>
            ) : null}

            {shouldShowAuthorizeButton && (
              <div className="mt-4">
                <AuthorizeButton
                  text={`Authorize ${name}`}
                  authorizeUrl={`${authorize_url}&redirect_uri=http://localhost:3003/oauth/callback`}
                />
              </div>
            )}

            {hasFormFields && showSettings && (
              <Fragment>
                <div className="relative my-4">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white text-sm text-gray-500">
                      Settings
                    </span>
                  </div>
                </div>
                <ConnectionForm
                  connection={selectedConnection}
                  closeForm={() => setShowSettings(false)}
                />
              </Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ConnectionDetails;
