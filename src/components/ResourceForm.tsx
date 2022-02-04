import {
  Button,
  CheckBox,
  DateInput,
  TextArea,
  TextInput,
} from '@apideck/components';
import React, { ChangeEvent } from 'react';

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
  const { selectedConnection, updateConnection, isUpdating } = useConnections();
  if (!selectedConnection) return null;
  const {
    unified_api: unifiedApi,
    service_id: serviceId,
    resources,
  } = selectedConnection;

  const formFields = resources?.find((r: any) => r.id === resource)?.config;

  if (!formFields) return null;

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
      const result = await updateConnection(unifiedApi, serviceId, {
        settings: { ...body },
      });
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
                {/* {type === 'filtered-select' && (
                  <FilteredSelect
                    field={field}
                    formikProps={formik}
                    className="max-w-sm"
                  />
                )} */}
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
