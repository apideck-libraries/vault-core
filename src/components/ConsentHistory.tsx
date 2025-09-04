import { Button } from '@apideck/components';
import { Disclosure } from '@headlessui/react';
import React, { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { Connection, ConsentRecord } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import ConfirmModal from './ConfirmModal';

interface Props {
  connection: Connection;
  setCurrentView?: Dispatch<
    SetStateAction<ConnectionViewType | null | undefined>
  >;
}

const ScopeRow: React.FC<{
  scope: string;
  permissions: { read: boolean; write: boolean };
}> = ({ scope, permissions }) => {
  return (
    <div
      className={`flex fade-in justify-between items-center py-2 px-3 text-sm border-b border-gray-100 dark:border-gray-800 last:border-b-0`}
    >
      <span className="text-gray-700 dark:text-gray-300 flex items-center truncate">
        {scope}
      </span>
      <div className="flex items-center space-x-1">
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

const ScopesDetail: React.FC<{
  scopes?: ConsentRecord['resources'];
}> = ({ scopes }) => {
  const { t } = useTranslation();
  const resources = Object.keys(scopes || {});

  return (
    <div className="space-y-2 pb-2">
      {resources.map((resource) => {
        const resourceName = resource.split('.').pop();
        const fields = scopes?.[resource] || {};
        const fieldNames = Object.keys(fields);

        return (
          <Disclosure key={resource} as="div" defaultOpen={true}>
            {({ open }) => (
              <div className="fade-in shadow-xs rounded-md bg-gray-50 relative">
                <Disclosure.Button className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-gray-100 text-left ring-gray-100 ring-1 ring-inset">
                  <div className="flex items-center">
                    <span className="font-medium capitalize text-sm">
                      {resourceName}
                    </span>
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
                    />
                  ))}
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        );
      })}
    </div>
  );
};

const SkeletonLoader = ({ className }: { className?: string }) => (
  <div className={`block animate-pulse px-3 ${className}`}>
    <ul role="list" className="-mb-4">
      {[...Array(4)].map((_, i) => (
        <li key={i}>
          <div className="relative pb-4">
            {i !== 3 && (
              <span
                className="absolute top-4 left-3.5 -ml-px h-20 w-0.5 bg-gray-200"
                aria-hidden="true"
              ></span>
            )}
            <div className="relative flex space-x-3">
              <div>
                <span className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center ring-8 ring-white"></span>
              </div>
              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                <div>
                  <div className="h-4 bg-gray-200 rounded w-2/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mt-2"></div>
                </div>
                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const ConsentHistory = ({ connection, setCurrentView }: Props) => {
  const { revokeConsent, isUpdating, unifyBaseUrl, headers } = useConnections();
  const { t } = useTranslation();
  const { session } = useSession();
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const dataScopes = connection.application_data_scopes;

  const fetcher = async (url: string) => {
    const response = await fetch(url, { headers });
    return await response.json();
  };

  const consentUrl = connection.id
    ? `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}/consent`
    : null;

  const {
    data: consentData,
    error: consentError,
    isValidating,
  } = useSWR(consentUrl, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });

  const records = consentData?.data || [];

  const filteredResources = useMemo(() => {
    if (
      !dataScopes?.resources ||
      typeof dataScopes.resources === 'string' ||
      !connection.unified_api
    ) {
      return undefined;
    }
    const resources = Object.fromEntries(
      Object.entries(dataScopes.resources).filter(([key]) =>
        key.startsWith(`${connection.unified_api}.`)
      )
    );
    return Object.keys(resources).length > 0 ? resources : undefined;
  }, [dataScopes?.resources, connection.unified_api]);

  const getScopeSummary = (resources: ConsentRecord['resources']) => {
    if (resources === '*') return t('All data access');
    if (typeof resources === 'object' && resources !== null) {
      const resourceCount = Object.keys(resources).length;
      const fieldCount = Object.values(resources).reduce(
        (acc: number, resource: any) => acc + Object.keys(resource).length,
        0
      );
      return t('{{resourceCount}} resources, {{fieldCount}} fields', {
        resourceCount,
        fieldCount,
      });
    }
    return t('No scope specified');
  };

  const canRevoke =
    connection.consent_state === 'implicit' ||
    connection.consent_state === 'granted';

  if (!session?.data_scopes?.enabled)
    return (
      <div className="text-center py-10 px-6">
        <h3 className="text-lg font-medium text-gray-900">
          {t('Data scopes not enabled')}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {t(
            'Data scopes are not enabled. Please contact the application owner.'
          )}
        </p>
      </div>
    );

  if (!connection) return <SkeletonLoader className="my-8 mx-4" />;

  const ErrorView = () => {
    const { t } = useTranslation();

    return (
      <div className="text-center py-10 px-6">
        <svg
          className="mx-auto h-12 w-12 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          {t('Unable to load consent history')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t(
            'There was an error loading the consent history. Please try again later.'
          )}
        </p>
      </div>
    );
  };

  const NoHistory = () => {
    const { t } = useTranslation();

    if (connection.consent_state === 'implicit') {
      return (
        <div className="text-center py-10 px-6">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">
            {t('Grant Access')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              "To finish setting up this connection, you'll need to grant access to the requested permissions."
            )}
          </p>
          <div className="mt-6">
            <Button
              text={t('Grant Access')}
              onClick={() =>
                setCurrentView &&
                setCurrentView(ConnectionViewType.ConsentScreen)
              }
              className="w-full"
            />
            <Button
              text={t('Revoke access')}
              variant="danger-outline"
              className="mt-2 w-full"
              onClick={() => setShowRevokeModal(true)}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="text-center py-10">
        <p className="text-sm text-gray-500">
          {t('No consent history available for this connection.')}
        </p>
      </div>
    );
  };

  return (
    <>
      <ConfirmModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        onConfirm={() => revokeConsent(connection, filteredResources)}
        title={t('Revoke access?')}
        description={t(
          'This will stop all data sharing with the application. Are you sure?'
        )}
        confirmButtonText={t('Yes, revoke access')}
      />
      <div className="p-6 px-3">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-3 px-3">
          {t('Consent History')}
        </h3>
        {isValidating && !consentData ? (
          <div className="flow-root">
            <div className="max-h-80 h-full overflow-y-auto">
              <SkeletonLoader />
            </div>
          </div>
        ) : consentError && !consentData && !isValidating ? (
          <ErrorView />
        ) : (
          <div className="flow-root">
            {records.length > 0 ? (
              <ul role="list" className="-mb-4 max-h-80 overflow-y-auto px-3">
                {records
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((record, recordIdx) => {
                    const resourcesToShow = record.resources;
                    const isExpandable =
                      typeof resourcesToShow === 'object' &&
                      resourcesToShow !== null;

                    return (
                      <li key={record.id}>
                        <Disclosure>
                          {({ open }) => (
                            <>
                              <div className="relative pb-4">
                                {recordIdx !== records.length - 1 ? (
                                  <span
                                    className="absolute top-4 left-3.5 -ml-px h-full w-0.5 bg-gray-200"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span
                                      className={`h-7 w-7 rounded-full flex items-center justify-center ring-8 ring-white ${
                                        record.granted
                                          ? 'bg-green-500'
                                          : 'bg-red-500'
                                      }`}
                                    >
                                      {record.granted ? (
                                        <svg
                                          className="h-4 w-4 text-white"
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                          aria-hidden="true"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          className="h-4 w-4 text-white"
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                          aria-hidden="true"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1 pt-0.5 flex justify-between space-x-4">
                                    <div>
                                      <p className="text-sm text-gray-500">
                                        {record.granted
                                          ? t('Access Granted')
                                          : t('Access Denied')}
                                      </p>
                                      <div className="group inline-flex items-center">
                                        <p className="text-sm font-medium text-gray-900">
                                          {getScopeSummary(resourcesToShow)}
                                        </p>
                                        {isExpandable && (
                                          <Disclosure.Button className="ml-1 text-gray-500 group-hover:text-gray-700">
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className={`h-5 w-5 transition-transform ${
                                                open
                                                  ? 'transform rotate-180'
                                                  : ''
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
                                          </Disclosure.Button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                      <time dateTime={record.created_at}>
                                        {(() => {
                                          const date = new Date(
                                            record.created_at
                                          );
                                          const currentYear =
                                            new Date().getFullYear();
                                          const isCurrentYear =
                                            date.getFullYear() === currentYear;

                                          return new Intl.DateTimeFormat(
                                            'en-US',
                                            {
                                              year: isCurrentYear
                                                ? undefined
                                                : 'numeric',
                                              month: 'short',
                                              day: 'numeric',
                                              hour: 'numeric',
                                              minute: 'numeric',
                                            }
                                          ).format(date);
                                        })()}
                                      </time>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <Disclosure.Panel className="pb-2">
                                {isExpandable && (
                                  <ScopesDetail scopes={resourcesToShow} />
                                )}
                              </Disclosure.Panel>
                            </>
                          )}
                        </Disclosure>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <NoHistory />
            )}
            {canRevoke && records.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 px-3 bg-white relative">
                <Button
                  text={t('Revoke access')}
                  variant="danger"
                  onClick={() => setShowRevokeModal(true)}
                  isLoading={isUpdating}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ConsentHistory;
