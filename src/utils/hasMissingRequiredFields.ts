import { FormField } from '../types/FormField';

export const hasMissingRequiredFields = (
  resources: {
    resource: string;
    defaults: FormField[];
  }[]
) => {
  let missingRequiredFields = false;
  resources?.forEach((r) => {
    const found = r.defaults?.find(
      (field: FormField) => field.required && !field.value
    );
    if (found) missingRequiredFields = true;
  });

  return missingRequiredFields;
};
