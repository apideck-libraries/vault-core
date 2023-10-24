export interface CustomMapping {
  description: string;
  id: string;
  key: string;
  label: string;
  required: boolean;
  value: string;
  consumer_id?: string;
  custom_field?: boolean;
}
