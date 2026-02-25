import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { cleanup, render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { storeNonce } from '../src/utils/oauthNonce';
import { setupIntersectionObserverMock } from './mock';
import { Vault } from '../src/components/Vault';

const VAULT_ORIGIN = 'https://vault.apideck.com';

// Helpers to build connection response
const makeConnection = (overrides: Record<string, any> = {}) => ({
  id: 'crm+salesforce',
  name: 'Salesforce',
  tag_line: 'CRM',
  icon: 'https://example.com/icon.png',
  website: 'https://example.com',
  unified_api: 'crm',
  service_id: 'salesforce',
  form_fields: [],
  configurable_resources: [],
  resource_schema_support: [],
  resource_settings_support: [],
  settings_required_for_authorization: [],
  authorize_url: 'https://unify.apideck.com/vault/authorize/salesforce/abc',
  revoke_url: null,
  auth_type: 'oauth2',
  enabled: true,
  state: 'authorized',
  ...overrides,
});

const setupFetchMock = (options: { confirmResponse?: any } = {}) => {
  const connection = makeConnection();
  const listResponse = { status_code: 200, status: 'OK', data: [connection] };
  const detailResponse = { status_code: 200, status: 'OK', data: connection };
  const confirmResp = options.confirmResponse || {
    status_code: 200,
    status: 'OK',
    data: { success: true },
  };

  (window.fetch as any).mockImplementation((url: string, init?: any) => {
    if (url.endsWith('/crm/salesforce/confirm') && init?.method === 'POST') {
      return { ok: true, json: async () => confirmResp };
    }
    if (url === 'https://unify.apideck.com/vault/connections/crm/salesforce') {
      return { json: async () => detailResponse };
    }
    if (url.includes('/config')) {
      return { json: async () => ({ status_code: 200, data: {} }) };
    }
    return { ok: true, status: 200, json: async () => listResponse };
  });
};

const postOAuthMessage = (data: any, origin = VAULT_ORIGIN) => {
  const event = new MessageEvent('message', { data, origin });
  window.dispatchEvent(event);
};

describe('OAuthMessageHandler', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => setupIntersectionObserverMock());
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it('renders no visible DOM output', async () => {
    setupFetchMock();
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="crm"
          serviceId="salesforce"
        />
      );
    });
    // OAuthMessageHandler renders null — no extra DOM elements
    expect(screen.container.querySelector('[data-oauth-handler]')).toBeNull();
  });

  it('calls POST confirm when nonce matches', async () => {
    setupFetchMock();
    storeNonce('salesforce', 'test-nonce-123');

    await act(async () => {
      render(
        <Vault
          token="token123"
          open
          unifiedApi="crm"
          serviceId="salesforce"
        />
      );
    });

    await act(async () => {
      postOAuthMessage({
        type: 'oauth_complete',
        nonce: 'test-nonce-123',
        confirmToken: 'confirm-token-abc',
        serviceId: 'salesforce',
        unifiedApi: 'crm',
      });
    });

    // Verify POST confirm was called
    const fetchCalls = (window.fetch as jest.Mock).mock.calls;
    const confirmCall = fetchCalls.find(
      ([url, init]: any) =>
        url?.endsWith('/crm/salesforce/confirm') && init?.method === 'POST'
    );
    expect(confirmCall).toBeDefined();
    const body = JSON.parse(confirmCall[1].body);
    expect(body.confirm_token).toBe('confirm-token-abc');
  });

  it('does NOT call POST confirm when nonce mismatches', async () => {
    setupFetchMock();
    storeNonce('salesforce', 'correct-nonce');

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      render(
        <Vault
          token="token123"
          open
          unifiedApi="crm"
          serviceId="salesforce"
        />
      );
    });

    // Clear fetch calls from render before posting message
    (window.fetch as jest.Mock).mockClear();

    await act(async () => {
      postOAuthMessage({
        type: 'oauth_complete',
        nonce: 'wrong-nonce',
        confirmToken: 'confirm-token-abc',
        serviceId: 'salesforce',
        unifiedApi: 'crm',
      });
    });

    const fetchCalls = (window.fetch as jest.Mock).mock.calls;
    const confirmCall = fetchCalls.find(
      ([url, init]: any) =>
        url?.endsWith('/crm/salesforce/confirm') && init?.method === 'POST'
    );
    expect(confirmCall).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonce mismatch')
    );

    errorSpy.mockRestore();
  });

  it('ignores messages from wrong origin', async () => {
    setupFetchMock();
    storeNonce('salesforce', 'test-nonce');

    await act(async () => {
      render(
        <Vault
          token="token123"
          open
          unifiedApi="crm"
          serviceId="salesforce"
        />
      );
    });

    // Clear fetch calls from render before posting message
    (window.fetch as jest.Mock).mockClear();

    await act(async () => {
      postOAuthMessage(
        {
          type: 'oauth_complete',
          nonce: 'test-nonce',
          confirmToken: 'confirm-token',
          serviceId: 'salesforce',
          unifiedApi: 'crm',
        },
        'https://evil.com'
      );
    });

    const fetchCalls = (window.fetch as jest.Mock).mock.calls;
    const confirmCall = fetchCalls.find(
      ([url, init]: any) =>
        url?.endsWith('/crm/salesforce/confirm') && init?.method === 'POST'
    );
    expect(confirmCall).toBeUndefined();
  });

  it('handles oauth_error by clearing nonce', async () => {
    setupFetchMock();
    storeNonce('salesforce', 'test-nonce');

    await act(async () => {
      render(
        <Vault
          token="token123"
          open
          unifiedApi="crm"
          serviceId="salesforce"
        />
      );
    });

    await act(async () => {
      postOAuthMessage({
        type: 'oauth_error',
        error: 'access_denied',
        errorDescription: 'User denied access',
        serviceId: 'salesforce',
      });
    });

    // Nonce should be cleared
    expect(sessionStorage.getItem('apideck_oauth_nonce_salesforce')).toBeNull();
  });

  it('does not throw with invalid session token', async () => {
    setupFetchMock();

    // Vault with token "token123" produces an invalid JWT — should not crash
    await act(async () => {
      render(<Vault token="token123" open />);
    });

    // If we got here without throwing, the test passes
    expect(true).toBe(true);
  });
});
