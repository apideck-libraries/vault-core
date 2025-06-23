import { FormField } from './FormField';

export interface RawJSON {
  [key: string]: string | string[] | number | boolean | undefined;
}

export interface Settings extends RawJSON {
  instance_url?: string;
  base_url?: string;
}

export type ConnectionState =
  | 'available'
  | 'added'
  | 'authorized'
  | 'callable'
  | 'invalid';
export type IntegrationState =
  | 'needs_configuration'
  | 'disabled'
  | 'configured';

export type OauthGrantType =
  | 'client_credentials'
  | 'authorization_code'
  | 'password';

export interface CustomMapping {
  custom_field: boolean;
  description: string;
  id: string;
  key: string;
  label: string;
  required: false;
  value: string;
}

export type ConsentState =
  | 'implicit'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'revoked'
  | 'requires_reconsent';

export interface ConsentRecord {
  id: string;
  timestamp: string;
  granted: boolean;
  resources:
    | '*'
    | {
        [apiScopedResourceName: string]: {
          [dotField: string]: {
            read: boolean;
            write: boolean;
          };
        };
      };
}

export interface Connection {
  id: string;
  service_id: string;
  unified_api: string;
  auth_type: string | null;
  name: string;
  icon: string;
  logo?: string;
  website?: string;
  tag_line?: string;
  authorize_url?: string;
  revoke_url?: string | null;
  state: ConnectionState;
  integration_state: IntegrationState;
  enabled?: boolean;
  settings?: Settings;
  settings_required_for_authorization?: string[];
  configurable_resources: string[];
  resource_schema_support: string[];
  configuration?: { resource: string; defaults: FormField[] }[];
  form_fields: FormField[];
  created_at?: number;
  updated_at?: number;
  resources?: { id: string; config: any }[];
  oauth_grant_type?: OauthGrantType;
  has_guide?: boolean;
  validation_support?: boolean;
  custom_mappings: CustomMapping[];
  consent_state?: ConsentState;
  consents?: ConsentRecord[];
}
