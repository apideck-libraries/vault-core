import { Button, TextInput } from '@apideck/components';
import React, { Dispatch, Fragment, SetStateAction } from 'react';

import { useFormik } from 'formik';
import { Markdown } from './Markdown';
import { Connection } from '../types/Connection';
import { SessionSettings } from '../types/SessionSettings';
import { useConnections } from '../utils/useConnections';
import SearchSelect from './SearchSelect';

interface Props {
  connection: Connection;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  settings: SessionSettings;
}

const ConnectionForm = ({ connection, setShowSettings, settings }: Props) => {
  const { updateConnection, isUpdating } = useConnections();

  const formFields = connection.form_fields;
  const initialValues = formFields.reduce((acc: any, formField) => {
    const { id, value } = formField;
    acc[id] = value;
    return acc;
  }, {}) as Record<string, readonly string[]>;
  const filteredFormFields = formFields.filter((field) => !field.hidden);

  if (!filteredFormFields.length) return null;

  const formik = useFormik({
    initialValues,
    onSubmit: async (values) => {
      setShowSettings(false);
      const updatedConnection = await updateConnection({
        unifiedApi: connection.unified_api,
        serviceId: connection.service_id,
        values: { settings: { ...values } },
      });
      if (!updatedConnection) {
        setShowSettings(true);
      }
    },
  });

  return (
    <Fragment>
      <form
        className="space-y-4 text-left"
        onSubmit={formik.handleSubmit}
        id="react-vault-connection-form"
        data-testid="connection-form"
      >
        {filteredFormFields.map((field, i) => {
          const {
            id,
            label,
            required,
            placeholder,
            description,
            disabled,
            type,
            options,
            sensitive,
            allow_custom_values: allowCustomValues,
          } = field;
          return (
            <div key={i}>
              <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-700"
              >
                {label}
                {required && <span className="ml-1 text-red-600">*</span>}
              </label>
              <div className="mt-1">
                {(type === 'text' || type === 'password') && (
                  <TextInput
                    name={id}
                    type="text"
                    required={required}
                    placeholder={placeholder}
                    onChange={formik.handleChange}
                    disabled={disabled}
                    value={formik.values[id] as any}
                    data-testid={id}
                    sensitive={type === 'password' || sensitive}
                    canBeCopied={type === 'password' || sensitive}
                  />
                )}
                {type === 'select' && (
                  <SearchSelect
                    field={id}
                    handleChange={formik.handleChange}
                    disabled={disabled}
                    value={formik.values[id] as any}
                    options={options as any}
                    placeholder={
                      disabled
                        ? 'Available after authorization'
                        : placeholder || 'Select..'
                    }
                    isCreatable={allowCustomValues}
                  />
                )}
                {description && (
                  <small className="markdown inline-block mt-2 text-gray-500 overflow-x-auto w-full">
                    <Markdown>{description}</Markdown>
                  </small>
                )}
              </div>
            </div>
          );
        })}

        <Button
          type="submit"
          text="Save"
          isLoading={isUpdating}
          size="large"
          className="w-full"
        />
      </form>
      {connection.has_guide && !settings?.hide_guides && (
        <div className="flex text-sm items-center text-gray-600 rounded-b-xl py-3 px-5 md:px-6 bg-gray-100 -mx-5 md:-mx-6 -mb-5 md:-mb-6 mt-4 border-t border-gray-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            className="w-5 h-5 mr-1"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
            />
          </svg>

          <span>
            Need help? View our{' '}
            <a
              className="inline-flex items-center text-main hover:text-main underline font-semibold hover:text-primary-600 transition"
              target="_blank"
              rel="noreferrer"
              href={`https://developers.apideck.com/connectors/${connection.service_id}/docs/consumer+connection`}
            >
              Connection Guide
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="w-4 h-4 ml-1"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </span>
        </div>
      )}
    </Fragment>
  );
};

export default ConnectionForm;
