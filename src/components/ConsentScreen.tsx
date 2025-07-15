import { Alert, Button } from '@apideck/components';
import { Disclosure } from '@headlessui/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Connection, ConsentRecord } from '../types/Connection';
import { useConnections } from '../utils/useConnections';
import ConfirmModal from './ConfirmModal';
import TopBar from './TopBar';

interface ScopeProps {
  scopes: NonNullable<Connection['application_data_scopes']>['resources'];
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
      <span className="text-gray-700 dark:text-gray-300 flex items-center truncate">
        {scope}
        {isNew && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            New
          </span>
        )}
      </span>
      <div className="flex items-center space-x-1.5">
        {permissions.read && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Read
          </span>
        )}
        {permissions.write && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
        const fieldNames = Object.keys(fields).sort((a, b) => {
          const aIsNew = newFields?.has(`${resource}.${a}`);
          const bIsNew = newFields?.has(`${resource}.${b}`);

          if (aIsNew && !bIsNew) return -1;
          if (!aIsNew && bIsNew) return 1;

          return a.localeCompare(b);
        });
        const hasNewFields = fieldNames.some((fieldName) =>
          newFields?.has(`${resource}.${fieldName}`)
        );

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
                    {hasNewFields && (
                      <span className="ml-2 fade-in inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        New
                      </span>
                    )}
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
  onClose: () => void;
  onDeny: (filteredResources: any) => void;
}

const ConsentScreen: React.FC<Props> = ({ connection, onClose, onDeny }) => {
  const { t } = useTranslation();
  const { grantConsent, isUpdating } = useConnections();
  const dataScopes = connection.application_data_scopes;
  const [showDenyModal, setShowDenyModal] = useState(false);

  const filteredResources = useMemo(() => {
    if (!dataScopes?.resources || typeof dataScopes.resources === 'string') {
      return undefined;
    }
    const resources = dataScopes.resources;
    return Object.keys(resources).length > 0 ? resources : undefined;
  }, [dataScopes?.resources]);

  const hasDataScopes = dataScopes?.enabled && !!filteredResources;

  const newFields = useMemo(() => {
    if (
      connection.consent_state !== 'requires_reconsent' ||
      !connection.latest_consent?.granted ||
      !filteredResources ||
      connection.latest_consent.resources === '*'
    ) {
      return new Set<string>();
    }

    const oldFields = new Set<string>();
    const resources = connection.latest_consent?.resources as Exclude<
      ConsentRecord['resources'],
      '*'
    >;
    for (const resource in resources) {
      for (const field in resources[resource]) {
        oldFields.add(`${resource}.${field}`);
      }
    }

    const currentFields = new Set<string>();
    if (filteredResources) {
      for (const resource in filteredResources) {
        for (const field in filteredResources[resource]) {
          currentFields.add(`${resource}.${field}`);
        }
      }
    }

    return new Set([...currentFields].filter((field) => !oldFields.has(field)));
  }, [connection, filteredResources]);

  return (
    <>
      <ConfirmModal
        isOpen={showDenyModal}
        onClose={() => setShowDenyModal(false)}
        onConfirm={() => onDeny(filteredResources)}
        title={t('Deny access?')}
        description={t(
          'If you deny access, you will not be able to use this integration. Are you sure?'
        )}
        confirmButtonText={t('Yes, deny access')}
      />
      <TopBar
        onClose={onClose}
        onBack={onClose}
        hideOptions={true}
        singleConnectionMode={true}
      />
      <div className="h-full p-6 text-center fade-in">
        <h2 className="text-lg font-semibold mb-2">
          {newFields.size > 0
            ? t('Updated Permissions Requested')
            : t('Requested Data Access')}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          {newFields.size > 0
            ? t(
                'This integration has been updated and requires access to additional data.'
              )
            : t(
                'The application is requesting permission to access the following data.'
              )}
        </p>

        {hasDataScopes && filteredResources ? (
          <ScopesList scopes={filteredResources} newFields={newFields} />
        ) : (
          <Alert
            variant="info"
            title={t('Full Data Access')}
            className="!text-left"
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
            <Button
              text={t('Accept')}
              isLoading={isUpdating}
              disabled={isUpdating}
              onClick={() => grantConsent(connection, dataScopes?.resources)}
              size="large"
              className="w-full !truncate"
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
