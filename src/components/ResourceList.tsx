import React from 'react';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { FormField } from '../types/FormField';
import { useConnections } from '../utils/useConnections';

const ResourceList = ({
  connection,
  setSelectedResource,
}: {
  connection: Connection;
  setSelectedResource: (resource: string) => void;
}) => {
  const { resources } = useConnections();
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden bg-white border rounded-md">
      <ul className="divide-y divide-gray-200">
        {connection?.configurable_resources.map(
          (resource: string, index: number) => {
            const config = resources?.find((r) => r.resource === resource);
            const hasRequiredFieldsWithoutValue = config?.defaults.filter(
              (field: FormField) => field.required && !field.value
            )?.length;

            return (
              <li key={`resource-${index}`}>
                <button
                  className="flex w-full capitalize items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 sm:px-6 hover:bg-gray-50"
                  onClick={() => setSelectedResource(resource)}
                >
                  <span>{resource}</span>
                  {hasRequiredFieldsWithoutValue ? (
                    <div className="inline-flex items-center font-medium leading-none rounded-full whitespace-nowrap px-2 py-1 text-xs bg-yellow-100 text-yellow-800">
                      {t('Missing required fields')}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          }
        )}
      </ul>
    </div>
  );
};

export default ResourceList;
