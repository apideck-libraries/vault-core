export type VaultAction = 'delete' | 'disconnect' | 'reauthorize' | 'disable';

export interface SessionSettings {
  hide_resource_settings?: boolean;
  hide_consumer_card?: boolean;
  hide_guides?: boolean;
  allow_actions?: VaultAction[];
}

export interface SessionTheme {
  favicon?: string;
  logo?: string;
  primary_color?: string;
  sidepanel_background_color?: string;
  sidepanel_text_color?: string;
  vault_name?: string;
  privacy_url?: string;
  terms_url?: string;
}

export interface SessionConsumerMetadata {
  email?: string;
  account_name?: string;
  user_name?: string;
  image?: string;
}

// TODO: Old interface, update after data scopes resources are implemented on the get connection call
export interface DataScopes {
  enabled: boolean;
  modified: string;
  resources: {
    [apiScopedResourceName: string]: {
      [dotField: string]: {
        read: boolean;
        write: boolean;
      };
    };
  };
}

export interface Session {
  application_id?: string;
  consumer_id?: string;
  redirect_uri?: string;
  settings?: SessionSettings;
  theme?: SessionTheme;
  consumer_metadata?: SessionConsumerMetadata;
  jwt?: string;
  data_scopes?: DataScopes; // TODO: Remove this when data scopes resources are implemented on the get connection call
}
