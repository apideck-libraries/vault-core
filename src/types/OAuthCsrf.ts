export interface OAuthCompleteMessage {
  type: 'oauth_complete';
  // Echoed back by unify for wire compatibility; received but unused — the
  // client no longer verifies it (see oauthCsrf.ts `generateNonce`).
  nonce: string;
  confirmToken: string;
  serviceId: string;
  success: boolean;
}

export interface OAuthErrorMessage {
  type: 'oauth_error';
  error: string;
  errorDescription: string;
  serviceId: string;
}

export type OAuthPostMessage = OAuthCompleteMessage | OAuthErrorMessage;

export interface ConfirmResponse {
  status_code: number;
  status: string;
  data: {
    confirmed: boolean;
  };
}
