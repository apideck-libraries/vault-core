import {
  Button,
  Select,
  TextArea,
  TextInput,
  useModal,
  useToast,
} from '@apideck/components';
import React, { useState } from 'react';
import useSWR from 'swr';
import { BASE_URL } from '../constants/urls';
import { sessionStorageFetcher } from '../utils/sessionStorageFetcher';
import { useConnections } from '../utils/useConnections';
import { useTheme } from '../utils/useTheme';
import SearchSelect from './SearchSelect';

const fieldOptions = [
  { label: 'id', value: 'id' },
  { label: 'company_name', value: 'company_name' },
  { label: 'vision', value: 'vision' },
  { label: 'status', value: 'status' },
  { label: 'legal_name', value: 'legal_name' },
  { label: 'country', value: 'country' },
  { label: 'sales_tax_number', value: 'sales_tax_number' },
  { label: 'currency', value: 'currency' },
];

const TargetFieldForm = ({ onCreate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { removeModal } = useModal();
  const { addToast } = useToast();
  const [targetField, setTargetField] = useState();
  const { theme } = useTheme();
  const [selectedOriginField, setSelectedOriginField] = useState();

  const { selectedConnection, headers } = useConnections();

  const { data: apiData } = useSWR(
    selectedConnection
      ? `${BASE_URL}/connector/apis/${selectedConnection.unified_api}`
      : null,
    (url) => sessionStorageFetcher(url, headers),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const resources = apiData?.data?.resources || [];

  console.log('resources', resources);

  const onSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      console.log('create target field now');
      setTimeout(() => {
        setTargetField({
          name: e.target.field_name.value,
          description: e.target.description.value,
          resourceId: e.target.resource.value,
        });
      });
    } catch (error: any) {
      addToast({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (targetField) {
    return (
      <div>
        <div className="bg-gray-50 px-5 md:px-6 py-5 md:py-6 border-t border-b border-gray-200 space-y-4">
          <div className="ring-1 ring-gray-200 rounded-3xl p-6 bg-white">
            <h2 className="text-gray-900 font-semibold leading-8">
              <div
                className="flex items-center justify-between sm:space-x-3"
                style={{ minWidth: 170 }}
              >
                <img
                  src="https://platform.apideck.com/img/logo.png"
                  alt="apideck"
                  className="w-8 h-8 rounded-full ring-2 ring-gray-100"
                />

                <div className="flex-1 truncate hidden sm:block">
                  <h3 className="truncate" data-testid="connector-name">
                    <code>{targetField.name}</code>
                  </h3>
                </div>
              </div>
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              {targetField.description}
            </p>
            <p className="mt-6 flex items-baseline gap-x-1">
              <div className="inline-flex items-center px-2 py-1.5 text-sm font-medium text-center text-gray-600 bg-gray-50 ring-1 ring-gray-200/70 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 dark:focus:ring-gray-600">
                <code>{`${selectedConnection.unified_api} / ${targetField.resourceId}`}</code>
              </div>
            </p>
          </div>
          <div className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 rotate-90"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
          </div>
          <div className="ring-1 ring-gray-200 rounded-3xl p-6 bg-white">
            <h2 className="text-gray-900 font-semibold leading-8">
              <div
                className="flex items-center justify-between sm:space-x-3"
                style={{ minWidth: 170 }}
              >
                <img
                  src={selectedConnection.icon}
                  alt={selectedConnection.id}
                  className="w-8 h-8 rounded-full ring-2 ring-gray-100"
                />

                <div className="flex-1 truncate hidden sm:block">
                  <h3 className="truncate" data-testid="connector-name">
                    Origin field
                  </h3>
                </div>
              </div>
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-600">{`Select the field to map to ${targetField.name}`}</p>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              <SearchSelect
                name="connector"
                options={fieldOptions}
                placeholder="Select a field"
                isMulti={false}
                noOptionsMessage={() => 'No fields are available'}
                classNamePrefix="select"
                menuPlacement="top"
                onChange={(e) => {
                  setSelectedOriginField(e.value);
                }}
              />
            </p>
          </div>
          <Button
            text={'Save field mapping'}
            onClick={() =>
              onCreate({
                id: '1',
                name: 'company_vision',
                description:
                  'The vision of the company is to be the best in the world',
                resourceId: 'companies',
                originFields: [
                  {
                    connectorId: 'exact-online',
                    name: 'some_exact_field',
                  },
                  {
                    connectorId: 'quickbooks',
                    name: 'quick_math',
                  },
                  {
                    connectorId: 'activecampaign',
                    name: 'vision',
                  },
                ],
              })
            }
            isLoading={isLoading}
            disabled={!selectedOriginField}
            className="w-full mb-3"
            style={
              theme?.primary_color
                ? { backgroundColor: theme.primary_color }
                : {}
            }
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="text-left">
      <div className="bg-gray-50 px-5 md:px-6 py-5 border-t border-b border-gray-200 space-y-4 ">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium leading-5 text-gray-700"
          >
            Resource
          </label>
          <Select
            className="mt-1"
            placeholder="Select resource"
            name="resource"
            options={resources.map((resource) => ({
              label: resource.name,
              value: resource.id,
            }))}
          />
        </div>
        <div className="mt-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium leading-5 text-gray-700"
          >
            Name
          </label>
          <TextInput
            className="mt-1"
            placeholder="target_field_name"
            name="field_name"
          />
        </div>
        <div className="mt-4">
          <label
            htmlFor="description"
            className="block text-sm font-medium leading-5 text-gray-700"
          >
            Description
          </label>
          <TextArea
            className="mt-1"
            placeholder="Field description"
            name="description"
          />
        </div>
        <Button
          text={'Next'}
          type="submit"
          isLoading={isLoading}
          className="w-full mt-3"
          style={
            theme?.primary_color ? { backgroundColor: theme.primary_color } : {}
          }
        />
      </div>
    </form>
  );
};

export default TargetFieldForm;
