export interface FormField {
  id: string;
  label: string;
  value: string | string[] | number | boolean | undefined | null;
  default_value?: string | string[] | number | boolean | undefined | null;
  placeholder: string;
  mask: boolean;
  type:
    | 'select'
    | 'multi-select'
    | 'filtered-select'
    | 'text'
    | 'textarea'
    | 'number'
    | 'phone'
    | 'email'
    | 'url'
    | 'boolean'
    | 'hidden'
    | 'date'
    | 'password'
    | 'datetime'
    | unknown;
  required: boolean;
  description?: string;
  disabled: boolean;
  options: FormFieldOption[] | FormFieldOptionGroup[];
  custom_field: boolean;
  hidden: boolean;
  target?: 'custom_fields' | 'resource';
  filter?: Record<string, string>;
  allow_custom_values?: boolean;
  sensitive?: boolean;
  prefix?: string;
  suffix?: string;
}

export interface FormFieldOption {
  label: string;
  value: string | number | readonly string[] | undefined;
}

export interface FormFieldOptionGroup {
  id: string;
  label: string;
  options: FormFieldOption[];
}
