import { Button, useToast } from '@apideck/components';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';
import { Connection, CustomMapping } from '../types/Connection';
import { extractLastAttribute } from '../utils/extractLastAttribute';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import FieldSelector from './FieldSelector';

export const findByDescription = (obj: any, description: string): any => {
  for (const key in obj) {
    if (obj[key] instanceof Object) {
      const result = findByDescription(obj[key], description);
      if (result) {
        return result;
      }
    } else if (key === 'description' && obj[key] === description) {
      return obj;
    }
  }
  return null;
};

const renderReadableJSONPath = (
  jsonPath: string,
  responseDataPath?: string
): string => {
  // Remove $ and [' from the beginning and '] from every part
  let parts: any = jsonPath?.match(/[^[\]'$]+/g) || [];

  // If the first part equals the responseDataPath, remove the first part
  if (responseDataPath && parts[0] === responseDataPath) {
    parts = parts.slice(1);
  }

  // Join the parts with a dot
  return parts.length > 0 ? parts.join('.') : '';
};

const FieldMappingForm = ({
  selectedCustomMapping,
  setSelectedCustomMapping,
  showConsumer,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const { session } = useSession();
  const { mutate } = useSWRConfig();

  const {
    selectedConnection,
    headers,
    fetchResourceSchema,
    fetchCustomFields,
    unifyBaseUrl,
  } = useConnections();
  const buttonRef = useRef<any>(null);

  const [selectedMapping, setSelectedMapping] = useState<{
    title: string;
    description?: string;
    example?: string;
    type?: string;
    finder?: string;
  } | null>(null);

  const { data: schemaData } = useSWR(
    selectedConnection &&
      !selectedCustomMapping.custom_field &&
      selectedCustomMapping?.id && ['schema', selectedCustomMapping?.id],
    () => fetchResourceSchema(selectedCustomMapping?.id?.split('+')[1])
  );

  const { data: customFieldsData } = useSWR(
    selectedConnection &&
      selectedCustomMapping.custom_field &&
      selectedCustomMapping?.id && [
        'custom-fields',
        selectedConnection?.service_id,
        selectedCustomMapping?.id,
      ],
    () => fetchCustomFields(selectedCustomMapping?.id?.split('+')[1])
  );

  const schema = schemaData?.data;
  const schemaError = schemaData?.error && schemaData?.message;
  const customFields = customFieldsData?.data;
  const customFieldsError =
    customFieldsData?.error && customFieldsData?.message;
  const properties = schema?.properties;
  const responseDataPath = schema?.response_data_path;

  useEffect(() => {
    if (!selectedMapping) {
      if (selectedCustomMapping?.value) {
        const mappingObject = findByDescription(
          properties,
          selectedCustomMapping.value
        );

        const customField = customFields?.find(
          (f: any) => f.finder === selectedCustomMapping.value
        );

        if (!mappingObject && !customField) return;

        setSelectedMapping({
          title: extractLastAttribute(
            selectedCustomMapping.value,
            selectedCustomMapping.custom_field
          ),
          description: selectedCustomMapping.custom_field
            ? customField.description
            : selectedCustomMapping.value,
          type: selectedCustomMapping.custom_field
            ? 'Custom field'
            : mappingObject?.type,
          example: selectedCustomMapping.custom_field
            ? customField?.value
            : mappingObject?.example,
        });
        return;
      }
      buttonRef?.current?.focus();
    }
  }, [
    selectedMapping,
    extractLastAttribute,
    properties,
    selectedCustomMapping.value,
  ]);

  const createCustomMapping = async () => {
    if (!selectedConnection || !selectedMapping) return;

    try {
      setIsLoading(true);

      const url = `${unifyBaseUrl}/vault/custom-mappings/${selectedConnection.unified_api}/${selectedConnection.service_id}/${selectedCustomMapping.id}`;
      const response = await fetch(url, {
        method: selectedCustomMapping?.value ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify({
          value: selectedMapping.finder || selectedMapping.description,
        }),
      });
      const result = await response.json();

      if (result.data) {
        addToast({
          title: `Mapping ${
            selectedCustomMapping?.value ? 'updated' : 'created.'
          }`,
          type: 'success',
        });

        const detailUrl = `${unifyBaseUrl}/vault/connections/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`;
        const updatedConnection = {
          ...selectedConnection,
          custom_mappings:
            selectedConnection.custom_mappings?.map((f) =>
              f.id === result.data.id ? result.data : f
            ) || [],
        };
        mutate(detailUrl, { data: updatedConnection }, { revalidate: false });
        setSelectedCustomMapping(null);
      }
    } catch (error) {
      addToast({
        title: 'Error',
        description: (error as Error).message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div
        className={`bg-gray-50 p-5 border-t border-b border-gray-200 fade-in ${
          showConsumer ? '' : 'rounded-b-lg'
        }`}
      >
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-600 mb-1 ml-[19px]">
            Response key
          </label>
          <div className="ring-1 ring-gray-200 rounded-2xl p-5 bg-white flex flex-col justify-between h-[145px]">
            <h2 className="text-gray-900 font-semibold">
              <div
                className="flex items-center justify-between space-x-2.5 truncate"
                style={{ minWidth: 170 }}
              >
                {session?.theme?.logo && (
                  <img
                    src={session?.theme?.logo}
                    alt="logo"
                    className="w-7 h-7 rounded-full ring-2 ring-gray-100"
                  />
                )}

                {selectedCustomMapping?.label || selectedCustomMapping?.key}
              </div>
            </h2>
            <p className="text-sm text-gray-600 line-clamp-2">
              {selectedCustomMapping?.description || selectedCustomMapping?.key}
            </p>
            <p className="flex items-baseline">
              <div className="inline-flex items-center px-2 py-1 text-xs font-medium text-center text-gray-600 bg-gray-50 ring-1 ring-gray-200/70 rounded-lg">
                {`${selectedCustomMapping.id.split('+')[0]} / ${
                  selectedCustomMapping.id.split('+')[1]
                }`}
              </div>
            </p>
          </div>
        </div>
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 right-6 -top-2 absolute text-gray-700"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
            />
          </svg>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1 ml-[19px]">
            {`${selectedConnection?.name} property`}
          </label>
          <FieldSelector
            className="col-span-5"
            onSelect={(mappingField: any) => setSelectedMapping(mappingField)}
            isLoading={
              !schema && !customFields && !schemaError && !customFieldsError
            }
            error={schemaError || customFieldsError}
            buttonRef={buttonRef}
            customFields={customFields}
            triggerComponent={
              <OriginFieldCard
                selectedCustomMapping={selectedCustomMapping}
                selectedConnection={selectedConnection}
                selectedMapping={selectedMapping}
                responseDataPath={responseDataPath}
              />
            }
            triggerComponentProps={{
              className: 'text-left w-full h-full',
            }}
            responseDataPath={responseDataPath}
            properties={properties ? Object.entries(properties) : []}
            selectedCustomMapping={selectedCustomMapping}
          />
        </div>
        <Button
          text={'Save field mapping'}
          onClick={createCustomMapping}
          isLoading={isLoading}
          disabled={!selectedMapping}
          className="w-full mt-5"
          style={
            session?.theme?.primary_color
              ? { backgroundColor: session?.theme.primary_color }
              : {}
          }
        />
      </div>
    </div>
  );
};

type OriginFieldCardProps = {
  selectedConnection: Connection | null;
  selectedMapping: any;
  selectedCustomMapping: CustomMapping;
  open?: boolean;
  responseDataPath?: string;
};

const OriginFieldCard = ({
  selectedConnection,
  selectedCustomMapping,
  selectedMapping,
  open,
  responseDataPath,
}: OriginFieldCardProps) => {
  const { session } = useSession();
  const { t } = useTranslation();

  return (
    <div className="ring-1 ring-gray-200 rounded-2xl p-5 group shadow-sm hover:shadow-md transition duration-100 bg-white flex flex-col justify-between h-[145px]">
      <h2 className="text-gray-900 font-semibold">
        <div
          className="flex items-center justify-between space-x-2.5 truncate"
          style={{ minWidth: 170 }}
        >
          {session?.theme?.logo && (
            <img
              src={selectedConnection?.icon || selectedConnection?.logo}
              alt={selectedConnection?.id}
              className="w-7 h-7 rounded-full ring-2 ring-gray-100"
            />
          )}
          <div className="flex-1 truncate hidden sm:flex items-center justify-between">
            <span className="truncate">
              {!selectedMapping && selectedCustomMapping?.value
                ? extractLastAttribute(
                    selectedCustomMapping.value?.toString(),
                    selectedCustomMapping.custom_field
                  )
                : selectedMapping
                ? selectedMapping.title
                : selectedCustomMapping?.custom_field
                ? t('Select custom field')
                : t('Select field')}
            </span>
            <div className="inline-flex items-center py-1 px-2.5 text-sm font-medium text-center text-gray-500 bg-gray-50 border border-gray-300/50 rounded-lg group-hover:bg-gray-100">
              <span className="text-gray-600 group-hover:text-gray-900 mr-1">
                Edit
              </span>
              {open ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="text-gray-600 group-hover:text-gray-900 transition duration-100 h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 15.75l7.5-7.5 7.5 7.5"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="text-gray-600 group-hover:text-gray-900 transition duration-100 h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </h2>
      {selectedMapping ? (
        <>
          <div>
            {(!!selectedMapping?.type ||
              selectedCustomMapping?.custom_field) && (
              <p className="text-sm text-gray-600 truncate">
                {t('Type')}:{' '}
                <span className="text-gray-600">
                  {selectedMapping?.type || 'Custom field'}
                </span>
              </p>
            )}
            {!!selectedMapping?.example && (
              <p className="text-sm text-gray-600 truncate mb-1.5">
                {t('Example')}:{' '}
                <span className="text-gray-600">
                  {selectedMapping?.example?.toString()}
                </span>
              </p>
            )}
          </div>

          <p className="flex items-baseline">
            <div className="inline-flex items-center px-2 py-1 text-xs font-medium text-center text-gray-600 bg-gray-50 ring-1 ring-gray-200/70 rounded-lg overflow-y-auto hide-scrollbar">
              {selectedCustomMapping.custom_field
                ? t('Custom Field')
                : renderReadableJSONPath(
                    selectedMapping?.description,
                    responseDataPath
                  )}
            </div>
          </p>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-600">
            {t('Map a property to')}
            {` `}`${selectedCustomMapping?.label || selectedCustomMapping?.key}`
          </div>
          <p className="flex items-baseline">
            <div className="inline-flex items-center px-2 py-1 text-xs font-medium text-center text-gray-600 bg-gray-50 ring-1 ring-gray-200/70 rounded-lg">
              {t('None selected')}
            </div>
          </p>
        </>
      )}
    </div>
  );
};

export default FieldMappingForm;
