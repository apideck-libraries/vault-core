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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationState, setValidationState] =
    useState<ValidationState>('idle');

  const formFields = connection.form_fields;
  const showGuide = connection.has_guide && !settings?.hide_guides;
  const initialValues = formFields?.reduce((acc: any, formField) => {
    const { id, value } = formField;
    acc[id] = value;
    return acc;
  }, {}) as Record<string, readonly string[]>;
  const filteredFormFields = formFields?.filter((field) => !field.hidden);

  if (!filteredFormFields || !filteredFormFields.length) return null;

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
        setIsSubmitting(true);
        setCurrentView(undefined);
        const updatedConnection = await updateConnection({
          unifiedApi: connection.unified_api,
          serviceId: connection.service_id,
          values: { settings: { ...values } },
        });
        setIsSubmitting(false);

        if (!updatedConnection) {
          setCurrentView(ConnectionViewType.Settings);
        }
      }
    },
  });

  // If there is only one field and it is disabled, we can disable the save button as users needs to authorize first
  const hasSingleDisabledField =
    filteredFormFields?.length === 1 && filteredFormFields[0].disabled === true;

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

      {showGuide && validationState !== 'invalid' && (
        <div className="text-left mb-3 rounded-md border border-blue-100 bg-blue-50/40 px-3.5 py-2.5">
          <p className="text-sm text-gray-600 whitespace-nowrap overflow-x-auto">
            {t('Need help?')}{' '}
            <a
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium underline decoration-blue-600/30 hover:decoration-blue-600 transition-colors"
              target="_blank"
              rel="noreferrer"
              href={`https://developers.apideck.com/connectors/${connection.service_id}/docs/consumer+connection`}
            >
              {t('View our Connection Guide')}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-3.5 h-3.5 ml-0.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </p>
        </div>
      )}

      <form
        className="space-y-3 text-left"
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
                        ? t('Available after authorization')
                        : placeholder || t('Select..')
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
          isLoading={validationState === 'validating' || isSubmitting}
          size="large"
          className="w-full"
          disabled={hasSingleDisabledField}
          style={
            session?.theme?.primary_color
              ? { backgroundColor: session?.theme.primary_color }
              : {}
          }
        />
      </form>
    </>
  );
};

export default ConnectionForm;
