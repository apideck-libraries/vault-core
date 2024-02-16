import {
  Alert,
  Button,
  TextArea,
  TextInput,
  useToast,
} from '@apideck/components';
import React, { Dispatch, SetStateAction, useState } from 'react';

import { useFormik } from 'formik';
import { useTranslation } from 'react-i18next';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { SessionSettings } from '../types/Session';
import { useConnections } from '../utils/useConnections';
import { useSession } from '../utils/useSession';
import { Markdown } from './Markdown';
import SearchSelect from './SearchSelect';

interface Props {
  connection: Connection;
  setCurrentView: Dispatch<
    SetStateAction<ConnectionViewType | undefined | null>
  >;
  settings: SessionSettings;
}

type ValidationState = 'idle' | 'invalid' | 'valid' | 'validating';

const ConnectionForm = ({ connection, setCurrentView, settings }: Props) => {
  const { updateConnection } = useConnections();
  const { addToast } = useToast();
  const { session } = useSession();
  const { t } = useTranslation();
  const [validationState, setValidationState] =
    useState<ValidationState>('idle');

  const formFields = connection.form_fields;
  const showGuide = connection.has_guide && !settings?.hide_guides;
  const initialValues = formFields.reduce((acc: any, formField) => {
    const { id, value } = formField;
    acc[id] = value;
    return acc;
  }, {}) as Record<string, readonly string[]>;
  const filteredFormFields = formFields.filter((field) => !field.hidden);

  if (!filteredFormFields.length) return null;

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (connection.validation_support) {
        setValidationState('validating');
        const updatedConnection = await updateConnection({
          unifiedApi: connection.unified_api,
          serviceId: connection.service_id,
          values: { settings: { ...values } },
          quiet: true,
        });

        const valid =
          updatedConnection && updatedConnection.state !== 'invalid';

        if (valid) {
          addToast({
            type: 'success',
            title: t('Successfully connected to {{connectionName}}', {
              connectionName: connection.name,
            }),
          });
          if (updatedConnection?.state === 'callable') {
            setCurrentView(undefined);
          }
        }

        setValidationState(valid ? 'valid' : 'invalid');
      } else {
        setCurrentView(undefined);
        const updatedConnection = await updateConnection({
          unifiedApi: connection.unified_api,
          serviceId: connection.service_id,
          values: { settings: { ...values } },
        });

        if (!updatedConnection) {
          setCurrentView(ConnectionViewType.Settings);
        }
      }
    },
  });

  return (
    <>
      {validationState === 'invalid' && (
        <Alert
          className="text-left mb-2"
          description={
            <span>
              {showGuide ? (
                <>
                  Could not connect to {connection.name}. View our{' '}
                  <a
                    className="inline-flex items-center text-main hover:text-main underline font-semibold"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://developers.apideck.com/connectors/${connection.service_id}/docs/consumer+connection`}
                  >
                    Connection Guide
                  </a>{' '}
                  for help
                </>
              ) : (
                t(
                  'Could not connect to {{connectionName}}. Please check your credentials',
                  { connectionName: connection.name }
                )
              )}
            </span>
          }
          title={t('Connection failed')}
          variant="danger"
        />
      )}

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
            prefix,
            suffix,
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
                    valid={validationState === 'invalid' ? false : undefined}
                    required={required}
                    placeholder={placeholder}
                    onChange={(e) => {
                      if (prefix && e.currentTarget.value?.startsWith(prefix)) {
                        formik.setFieldValue(
                          id,
                          e.currentTarget.value.slice(prefix.length)
                        );
                      } else {
                        formik.handleChange(e);
                      }
                    }}
                    disabled={disabled}
                    value={formik.values[id] as any}
                    prepend={prefix}
                    append={suffix}
                    data-testid={id}
                    sensitive={type === 'password' || sensitive}
                  />
                )}
                {type === 'textarea' && (
                  <TextArea
                    name={id}
                    value={(formik.values[id] as any) || ''}
                    required={required}
                    placeholder={placeholder}
                    onChange={formik.handleChange}
                  />
                )}
                {(type === 'select' || type === 'multi-select') && (
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
                    isMulti={type === 'multi-select'}
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
          text={
            validationState === 'validating'
              ? t('Trying to connect...')
              : t('Save')
          }
          isLoading={validationState === 'validating'}
          size="large"
          className="w-full"
          style={
            session?.theme?.primary_color
              ? { backgroundColor: session?.theme.primary_color }
              : {}
          }
        />
      </form>
      {showGuide && (
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
            {t('Need help? View our')}{' '}
            <a
              className="inline-flex items-center text-main hover:text-main underline font-semibold hover:text-primary-600 transition"
              target="_blank"
              rel="noreferrer"
              href={`https://developers.apideck.com/connectors/${connection.service_id}/docs/consumer+connection`}
            >
              {t('Connection Guide')}
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
    </>
  );
};

export default ConnectionForm;
