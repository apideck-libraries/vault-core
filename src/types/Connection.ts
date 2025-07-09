import { FormField } from './FormField';
import { SessionConsumerMetadata } from './Session';

export interface ApplicationDataScopes {
  enabled: boolean;
  updatedAt: string;
  resources: {
    [apiScopedResourceName: string]: {
      [dotField: string]: {
        read: boolean;
        write: boolean;
      };
    };
  };
}

export enum ConsentState {
  Implicit = 'implicit',
  Pending = 'pending',
  Granted = 'granted',
  Denied = 'denied',
  Revoked = 'revoked',
  RequiresReconsent = 'requires_reconsent',
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

export interface Connection {
  id: string;
  service_id: string;
  unified_api: string;
  name: string;
  icon: string;
  logo?: string;
  website?: string;
  tag_line?: string;
  auth_type?: 'oauth2' | 'apiKey' | 'basic' | 'custom' | 'none';
  enabled?: boolean;
  state: ConnectionState;
  integration_state?: IntegrationState;
  form_fields?: FormField[];
  authorize_url?: string | null;
  revoke_url?: string | null;
  application_data_scopes?: ApplicationDataScopes;
  created_at?: number;
  updated_at?: number;
  configurable_resources?: string[];
  resource_schema_support?: string[];
  resource_settings_support?: string[];
  validation_support?: boolean;
  schema_support?: boolean;
  settings_required_for_authorization?: string[];
  has_guide?: boolean;
  settings?: {
    [key: string]: any;
  };
  metadata?: {
    [key: string]: any;
  };
  consumer_metadata?: SessionConsumerMetadata;
  custom_mappings?: any[];
  consent_state?: ConsentState;
  latest_consent?: ConsentRecord;
  consents?: ConsentRecord[];
  [key: string]: any;
}

export interface ConsentRecord {
  id: string;
  created_at: string;
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

export interface RawJSON {
  [key: string]: any;
}
