import { Alert, Button } from '@apideck/components';
import { Disclosure } from '@headlessui/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { DataScopes } from '../types/Session';
import { useSession } from '../utils/useSession';
import AuthorizeButton from './AuthorizeButton';
import ConfirmModal from './ConfirmModal';
import TopBar from './TopBar';

interface ScopeProps {
  scopes: DataScopes['resources'];
}

const ScopeRow: React.FC<{
  scope: string;
  permissions: { read: boolean; write: boolean };
  isNew?: boolean;
}> = ({ scope, permissions, isNew }) => {
  return (
    <div
      className={`flex fade-in justify-between items-center py-2 px-3 text-sm border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
        isNew ? 'bg-green-50 dark:bg-green-900/20' : ''
      }`}
    >
      <span className="text-gray-700 dark:text-gray-300 flex items-center">
        {scope}
        {isNew && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            New
          </span>
        )}
      </span>
      <div className="flex items-center space-x-1.5">
        {permissions.read && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Read
          </span>
        )}
        {permissions.write && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Write
          </span>
        )}
      </div>
    </div>
  );
};

const ScopesList: React.FC<ScopeProps & { newFields?: Set<string> }> = ({
  scopes,
  newFields,
}) => {
  const { t } = useTranslation();
  const resources = Object.keys(scopes);

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto">
      {resources.map((resource) => {
        const resourceName = resource.split('.').pop();
        const fields = scopes[resource];
        const fieldNames = Object.keys(fields);

        return (
          <Disclosure
            key={resource}
            as="div"
            className="fade-in shadow-xs rounded-md"
          >
            {({ open }) => (
              <>
                <Disclosure.Button className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 text-left ring-gray-100 ring-1 ring-inset">
                  <div className="flex items-center">
                    <span className="font-medium">{resourceName}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">
                      {t('{{count}} fields', { count: fieldNames.length })}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-5 w-5 transition-transform ${
                        open ? 'transform rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="border-b border-l border-r border-gray-100 rounded-b-md bg-white">
                  {fieldNames.map((fieldName) => (
                    <ScopeRow
                      key={fieldName}
                      scope={fieldName}
                      permissions={fields[fieldName]}
                      isNew={newFields?.has(`${resource}.${fieldName}`)}
                    />
                  ))}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        );
      })}
    </div>
  );
};

interface Props {
  connection: Connection;
  onConnectionChange?: (connection: Connection) => any;
  onClose: () => void;
  onDeny: () => void;
}

const ConsentScreen: React.FC<Props> = ({
  connection,
  onConnectionChange,
  onClose,
  onDeny,
}) => {
  const { session } = useSession();
  const { t } = useTranslation();
  const dataScopes = session?.data_scopes;
  const hasDataScopes = dataScopes?.enabled && dataScopes?.resources;
  const [showDenyModal, setShowDenyModal] = useState(false);

  const newFields = useMemo(() => {
    if (
      connection.consent_state !== 'requires_reconsent' ||
      !connection.consents ||
      !dataScopes?.resources
    ) {
      return new Set<string>();
    }

    const lastGrantedConsent = [...connection.consents]
      .reverse()
      .find((c) => c.granted);

    if (!lastGrantedConsent || lastGrantedConsent.resources === '*') {
      return new Set<string>();
    }

    const oldFields = new Set<string>();
    for (const resource in lastGrantedConsent.resources) {
      for (const field in lastGrantedConsent.resources[resource]) {
        oldFields.add(`${resource}.${field}`);
      }
    }

    const currentFields = new Set<string>();
    for (const resource in dataScopes.resources) {
      for (const field in dataScopes.resources[resource]) {
        currentFields.add(`${resource}.${field}`);
      }
    }

    return new Set([...currentFields].filter((field) => !oldFields.has(field)));
  }, [connection, dataScopes]);

  return (
    <>
      <ConfirmModal
        isOpen={showDenyModal}
        onClose={() => setShowDenyModal(false)}
        onConfirm={onDeny}
        title={t('Deny Access?')}
        description={t(
          'If you deny access, you will not be able to use this integration. Are you sure?'
        )}
        confirmButtonText={t('Yes, Deny Access')}
      />
      <TopBar
        onClose={onClose}
        onBack={onClose}
        hideOptions={true}
        singleConnectionMode={true}
      />
      <div className="h-full p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">
          {t('Requested Data Access')}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          {t(
            'The application is requesting permission to access the following data.'
          )}
        </p>
        {newFields.size > 0 && (
          <Alert
            variant="info"
            className="text-left mb-4"
            title={t('New permissions requested')}
            description={t(
              'The developer has updated the integration and requires additional permissions to keep it working.'
            )}
          />
        )}

        {hasDataScopes ? (
          <ScopesList scopes={dataScopes.resources} newFields={newFields} />
        ) : (
          <Alert
            variant="info"
            title={t('Full Data Access')}
            description={t(
              'This application is requesting access to all data available through this connection.'
            )}
          />
        )}

        <div className="mt-6">
          <p className="text-xs text-gray-500 mb-4">
            {t(
              'By authorizing you agree to grant the application access to the data listed above.'
            )}
          </p>
          <div className="flex flex-col space-y-3">
            <AuthorizeButton
              connection={connection}
              onConnectionChange={onConnectionChange}
            />
            <Button variant="outline" onClick={() => setShowDenyModal(true)}>
              {t('Deny')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConsentScreen;
