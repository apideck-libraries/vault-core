import AuthorizeButton from './AuthorizeButton';
import { Dialog } from '@headlessui/react';
import React from 'react';
import StatusBadge from './StatusBadge';
import { authorizationVariablesRequired } from '../utils/authorizationVariablesRequired';
import classNames from 'classnames';
import { useConnections } from '../utils/useConnections';

const ConnectionDetails = () => {
  const { selectedConnection, isUpdating } = useConnections();

  if (!selectedConnection) return null;

  const requiredAuth = authorizationVariablesRequired(selectedConnection);

  const { state, auth_type, authorize_url, name, tag_line } =
    selectedConnection;

  const shouldShowAuthorizeButton =
    state !== 'callable' && auth_type === 'oauth2' && !requiredAuth;

  return (
    <div>
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
      </div>
    </div>
  );
};
export default ConnectionDetails;
