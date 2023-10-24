import { Button, useToast } from '@apideck/components';
import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import { CustomMapping } from '../types/CustomMapping';
import { extractLastAttribute } from '../utils/extractLastAttribute';
import { useConnections } from '../utils/useConnections';
import FieldMappingForm from './FieldMappingForm';

const FieldMapping = ({ setShowFieldMapping, TopBarComponent }) => {
  const { unifyBaseUrl, selectedConnection, headers } = useConnections();
  const [selectedCustomMapping, setSelectedCustomMapping] =
    useState<null | CustomMapping>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(
    null
  );
  const { addToast } = useToast();
  const { mutate } = useSWRConfig();

  if (!selectedConnection) return null;

  const deleteCustomMapping = async (id: string) => {
    if (!selectedConnection) return;

    try {
      setDeletingMappingId(id);

      const url = `${unifyBaseUrl}/vault/custom-mappings/${selectedConnection.unified_api}/${selectedConnection.service_id}/${id}`;
      await fetch(url, { method: 'DELETE', headers });
      addToast({
        title: 'Mapping removed.',
        type: 'success',
      });
      const detailUrl = `${unifyBaseUrl}/vault/connections/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`;
      mutate(detailUrl);
    } catch (error) {
      addToast({
        title: 'Error',
        description: (error as Error).message,
        type: 'error',
      });
    } finally {
      setDeletingMappingId(null);
    }
  };

  return (
    <div>
      <TopBarComponent
        onBack={() => {
          if (selectedCustomMapping) {
            setSelectedCustomMapping(null);
          } else {
            setShowFieldMapping(null);
          }
        }}
        hideOptions={true}
      />
      <div className="h-full rounded-b-xl mt-3">
        <div className="text-center px-10">
          <p className="text-sm text-gray-700 mb-4">
            {selectedCustomMapping ? (
              <span>
                Select a source property from your{' '}
                <span className="font-medium">{selectedConnection.name}</span>{' '}
                data to the{' '}
                <span className="font-medium">
                  {selectedCustomMapping?.label}
                </span>{' '}
                field.
              </span>
            ) : (
              <span>
                Map properties from your{' '}
                <span className="font-medium">{selectedConnection.name}</span>{' '}
                data to one of the fields below.
              </span>
            )}
          </p>
        </div>
        {selectedCustomMapping && (
          <FieldMappingForm
            selectedCustomMapping={selectedCustomMapping}
            setSelectedCustomMapping={setSelectedCustomMapping}
          />
        )}

        {!selectedCustomMapping && (
          <div className="bg-gray-50 p-5 border-t border-b border-gray-200 max-h-[480px] overflow-y-auto">
            <div className="flex flex-col space-y-4">
              {selectedConnection?.custom_mappings?.map(
                (mapping: CustomMapping) => {
                  return (
                    <div
                      key={mapping.id}
                      className="ring-1 ring-gray-200 rounded-lg bg-white shadow-sm relative fade-in"
                    >
                      <div className="bg-gray-100 p-2 px-3 text-sm font-medium flex items-center justify-between">
                        <div>
                          <code style={{ fontWeight: 600 }}>
                            {mapping?.label || mapping?.key}
                          </code>
                          {mapping?.required && (
                            <span className="ml-1 text-red-600">*</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5">
                          {mapping?.value && (
                            <button
                              className="inline-flex items-center p-1.5 text-sm font-medium text-center text-gray-500 bg-gray-100 ring-1 ring-gray-300/60 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-50"
                              onClick={() => setSelectedCustomMapping(mapping)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                />
                              </svg>
                            </button>
                          )}
                          {mapping?.value && mapping.consumer_id && (
                            <button
                              className="inline-flex items-center p-1.5 text-sm font-medium text-center text-gray-500 bg-gray-100 ring-1 ring-gray-300/60 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-50"
                              onClick={() => deleteCustomMapping(mapping.id)}
                            >
                              {deletingMappingId === mapping.id ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="h-4 w-4 animate-spin"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center border-t justify-between sm:justify-start sm:space-x-2.5 p-2 px-3">
                        <img
                          src={selectedConnection.icon}
                          alt={selectedConnection.id}
                          className="w-8 h-8 rounded-full ring-2 ring-gray-100"
                        />

                        <div className="flex-1 truncate flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-xs text-gray-600 font-medium">
                              {mapping?.value ? (
                                <code className="font-semibold">
                                  {extractLastAttribute(
                                    mapping.value,
                                    mapping.custom_field
                                  )}
                                </code>
                              ) : (
                                <span className="text-red-600">Not mapped</span>
                              )}
                            </span>
                          </div>
                          {!mapping?.value && (
                            <Button
                              size="small"
                              onClick={() => setSelectedCustomMapping(mapping)}
                            >
                              Map field
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldMapping;
