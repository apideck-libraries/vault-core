import {
  Button,
  CheckBox,
  DateInput,
  TextArea,
  TextInput,
} from '@apideck/components';
import React, { ChangeEvent } from 'react';

import FilteredSelect from './FilteredSelect';
import { FormField } from '../types/FormField';
import Markdown from 'markdown-to-jsx';
import SearchSelect from './SearchSelect';
import { useConnections } from '../utils/useConnections';
import { useFormik } from 'formik';

interface Props {
  resource: string;
  closeForm: () => void;
}

const ResourceForm = ({ resource, closeForm }: Props) => {
  const { resources, selectedConnection, updateConnection, isUpdating } =
    useConnections();
  if (!selectedConnection) return null;
  const { unified_api: unifiedApi, service_id: serviceId } = selectedConnection;

  const formFields = resources?.find(
    (config: { resource: string; defaults: FormField[] }) =>
      config.resource === resource
  )?.defaults;

  if (!formFields)
    return (
      <div className="flex items-center justify-center h-20">
        <svg
          data-testid="loading-svg"
          className="h-6 w-6 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );

  const sortedFormFields = formFields.sort(
    (a: any, b: any) => b.required - a.required
  );

  const initialValues = sortedFormFields.reduce(
    (acc: any, formField: FormField) => {
      const { id, value } = formField;
      acc[id] = value || undefined;
      return acc;
    },
    {}
  );

  const targetMap = sortedFormFields.reduce(
    (acc: any, formField: FormField) => {
      const { id, target } = formField;
      acc[id] = target || undefined;
      return acc;
    },
    {}
  );

  const formik = useFormik({
    initialValues,
    onSubmit: async (values) => {
      const defaults = Object.entries(values)
        .map(([k, v]) => {
          return v !== undefined
            ? { id: k, value: v, target: targetMap[k] }
            : v;
        })
        .filter(Boolean);

      const body = { configuration: [{ resource, defaults }] };
      const result = await updateConnection(
        unifiedApi,
        serviceId,
        body,
        resource
      );
      if (result?.data) {
        closeForm && closeForm();
      }
    },
  });

  return (
    <form className="text-left" onSubmit={formik.handleSubmit}>
      <div className="bg-gray-50 -mx-5 md:-mx-6 px-5 md:px-6 py-5 border-t border-b border-gray-200 space-y-4 ">
        {formFields?.map((field: FormField) => {
          const {
            id,
            label,
            required,
            placeholder,
            description,
            type,
            options,
          } = field;
          return (
            <div key={id}>
              <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-700"
              >
                {label}
                {required && <span className="ml-1 text-red-600">*</span>}
              </label>
              <div className="mt-1">
                {[
                  'text',
                  'email',
                  'url',
                  'tel',
                  'number',
                  'time',
                  'location',
                  'password',
                ].includes(type as string) && (
                  <TextInput
                    name={id}
                    value={formik.values[id] || ''}
                    type={type as string}
                    required={required}
                    placeholder={placeholder}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className="max-w-sm"
                    data-testid={id}
                    sensitive={type === 'password'}
                  />
                )}
                {type === 'checkbox' && (
                  <CheckBox
                    name={id}
                    value={formik.values[id]}
                    defaultChecked={!!formik.values[id]}
                    placeholder={placeholder}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      formik.handleChange({
                        currentTarget: {
                          value: e.target.checked,
                          name: id,
                        },
                      })
                    }
                    onBlur={formik.handleBlur}
                  />
                )}
                {type === 'textarea' && (
                  <TextArea
                    name={id}
                    value={formik.values[id] || ''}
                    required={required}
                    placeholder={placeholder}
                    onChange={formik.handleChange}
                    className="max-w-sm"
                  />
                )}
                {(type === 'select' || type === 'multi-select') && (
                  <SearchSelect
                    field={id}
                    value={formik.values[id]}
                    handleChange={formik.handleChange}
                    placeholder="Select.."
                    options={(options as any[]) || []}
                    isMulti={type === 'multi-select'}
                    className="max-w-sm"
                  />
                )}
                {type === 'filtered-select' && (
                  <FilteredSelect
                    field={field}
                    formikProps={formik}
                    className="max-w-sm"
                  />
                )}
                {(type === 'date' || type === 'datetime') && (
                  <DateInput
                    name={id}
                    type={type}
                    value={formik.values[id]}
                    required={required}
                    onChange={formik.handleChange}
                    containerClassName="max-w-sm"
                  />
                )}
                {description && (
                  <p className="my-1 text-sm text-gray-500">
                    <Markdown>{description}</Markdown>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Button
        type="submit"
        text="Save"
        isLoading={isUpdating}
        size="large"
        className="w-full mt-5 md:mt-6 "
      />
    </form>
  );
};
export default ResourceForm;
