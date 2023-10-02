import { Button, useToast } from '@apideck/components';
import React, { useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Connection, CustomMapping } from '../types/Connection';
import { extractLastAttribute } from '../utils/extractLastAttribute';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import FieldSelector from './FieldSelector';

const FieldMappingForm = ({
  selectedCustomMapping,
  setSelectedCustomMapping,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const { session } = useSession();

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
      selectedCustomMapping?.id,
    () => fetchResourceSchema(selectedCustomMapping?.id?.split('+')[1])
  );

  const { data: customFieldsData } = useSWR(
    selectedConnection &&
      selectedCustomMapping.custom_field &&
      selectedCustomMapping?.id,
    () => fetchCustomFields(selectedCustomMapping?.id?.split('+')[1])
  );

  const schema = schemaData?.data;
  const customFields = customFieldsData?.data;
  const properties = schema?.properties;
  const responseDataPath = schema?.response_data_path;

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
      <div className="bg-gray-50 p-5 border-t border-b border-gray-200 fade-in">
        <div className="ring-1 ring-gray-200 rounded-2xl p-4 bg-white space-y-2.5">
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
              <code>{selectedCustomMapping?.key}</code>
            </div>
          </h2>
          <p className="text-sm leading-6 text-gray-600">
            {selectedCustomMapping?.label}
          </p>
          <p className="flex items-baseline gap-x-1">
            <div className="inline-flex items-center px-2 py-1 text-xs font-medium text-center text-gray-600 bg-gray-50 ring-1 ring-gray-200/70 rounded-lg">
              <code>{`${selectedCustomMapping.id.split('+')[0]} / ${
                selectedCustomMapping.id.split('+')[1]
              }`}</code>
            </div>
          </p>
        </div>
        <div className="flex items-center justify-center py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 rotate-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
        </div>
        <FieldSelector
          className="col-span-5"
          onSelect={(mappingField: any) => setSelectedMapping(mappingField)}
          isLoading={!schema && !customFields}
          buttonRef={buttonRef}
          customFields={customFields}
          triggerComponent={
            <OriginFieldCard
              selectedCustomMapping={selectedCustomMapping}
              selectedConnection={selectedConnection}
              selectedMapping={selectedMapping}
            />
          }
          triggerComponentProps={{
            className: 'text-left w-full h-full',
          }}
          responseDataPath={responseDataPath}
          properties={properties ? Object.entries(properties) : []}
          selectedCustomMapping={selectedCustomMapping}
        />
        <Button
          text={'Save field mapping'}
          onClick={createCustomMapping}
          isLoading={isLoading}
          disabled={!selectedMapping}
          className="w-full mt-4"
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
};

const OriginFieldCard = ({
  selectedConnection,
  selectedCustomMapping,
  selectedMapping,
  open,
}: OriginFieldCardProps) => {
  return (
    <div className="ring-1 ring-gray-200 rounded-2xl p-5 h-full group hover:shadow transition duration-100 bg-white">
      <h2 className="text-gray-900 font-semibold">
        <div
          className="flex items-center justify-between space-x-2.5 truncate"
          style={{ minWidth: 170 }}
        >
          <img
            src={selectedConnection?.icon || selectedConnection?.logo}
            alt={selectedConnection?.id}
            className="w-7 h-7 rounded-full ring-2 ring-gray-100"
          />

          <div className="flex-1 truncate hidden sm:flex items-center justify-between">
            <span className="truncate">
              <code className="font-bold">
                {!selectedMapping && selectedCustomMapping?.value
                  ? extractLastAttribute(
                      selectedCustomMapping.value,
                      selectedCustomMapping.custom_field
                    )
                  : selectedMapping
                  ? selectedMapping.title
                  : selectedCustomMapping?.custom_field
                  ? 'Select custom field'
                  : 'Select field'}
              </code>
            </span>
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="text-gray-400 group-hover:text-gray-900 transition duration-100 h-5 w-5"
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
                className="text-gray-400 group-hover:text-gray-900 transition duration-100 h-5 w-5"
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
      </h2>
      {selectedMapping ? (
        <div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Type:{' '}
            <span className="font-medium text-gray-800">
              {selectedMapping?.finder ? 'Custom field' : selectedMapping.type}
            </span>
          </p>

          <p className="mt-1 text-sm leading-6 text-gray-600 truncate">
            Example:{' '}
            <span className="font-medium text-gray-800">
              {selectedMapping.example?.toString() ||
                selectedMapping?.value?.toString() ||
                '-'}
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {`Select a ${
            selectedCustomMapping?.custom_field ? 'custom ' : ''
          }field to create a mapping.`}
        </p>
      )}
    </div>
  );
};

export default FieldMappingForm;
