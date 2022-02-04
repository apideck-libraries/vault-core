import { Button, TextInput } from '@apideck/components';

import { Connection } from '../types/Connection';
import Markdown from 'markdown-to-jsx';
import React from 'react';
import SearchSelect from './SearchSelect';
import { useConnections } from '../utils/useConnections';
import { useFormik } from 'formik';

interface Props {
  connection: Connection;
  closeForm: () => void;
}

const ConnectionForm = ({ connection, closeForm }: Props) => {
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
      const result = await updateConnection(
        connection.unified_api,
        connection.service_id,
        { settings: { ...values } }
      );
      if (result?.data) {
        closeForm();
      }
    },
  });

  return (
    <form className="space-y-4 text-left" onSubmit={formik.handleSubmit}>
      {filteredFormFields.map((field) => {
        const {
          id,
          label,
          required,
          placeholder,
          description,
          disabled,
          type,
          options,
          allow_custom_values: allowCustomValues,
        } = field;
        return (
          <div>
            <label
              htmlFor={id}
              className="block text-sm font-medium text-gray-700"
            >
              {label}
              {required && <span className="ml-1 text-red-600">*</span>}
            </label>
            <div className="mt-1">
              {type === 'text' && (
                <TextInput
                  name={id}
                  type="text"
                  required={required}
                  placeholder={placeholder}
                  onChange={formik.handleChange}
                  disabled={disabled}
                  value={formik.values[id] as any}
                  data-testid={id}
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
                <small className="inline-block mt-2 text-gray-600">
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
  );
};

export default ConnectionForm;
