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

export interface Session {
  application_id?: string;
  consumer_id?: string;
  redirect_uri?: string;
  settings?: SessionSettings;
  theme?: SessionTheme;
  consumer_metadata?: SessionConsumerMetadata;
  jwt?: string;
  data_scopes?: { enabled?: boolean };
  /**
   * Server-derived, resolved at session-mint time.
   * `hidden` is true only when the application has the setting on AND the
   * account is entitled to it, so a plan downgrade re-enables attribution on
   * the next session with no migration.
   * `hideable` reports the entitlement itself, which is what distinguishes an
   * authorised suppression from an unauthorised one.
   * Absent on tokens minted without an account (e.g. management sessions).
   */
  attribution?: { hidden?: boolean; hideable?: boolean };
}
