export interface OAuthCompleteMessage {
  type: 'oauth_complete';
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

export interface AuthorizeResponse {
  status_code: number;
  status: string;
  data: {
    authorize_url: string;
  };
}

export interface ConfirmResponse {
  status_code: number;
  status: string;
  data: {
    confirmed: boolean;
  };
}
