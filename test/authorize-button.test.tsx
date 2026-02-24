import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { setupIntersectionObserverMock } from './mock';
import { cleanup, render, waitFor } from '@testing-library/react';

import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { CONFIG } from './responses/config';

const makeConnection = (serviceId: string, overrides: Record<string, any>) => ({
  id: `ecommerce+${serviceId}`,
  name: 'Test Connector',
  tag_line: 'Test connector for authorize button tests',
  icon: 'https://example.com/icon.png',
  website: 'https://example.com',
  unified_api: 'ecommerce',
  service_id: serviceId,
  form_fields: [],
  configurable_resources: [],
  resource_schema_support: [],
  resource_settings_support: [],
  settings_required_for_authorization: [],
  authorize_url: `https://unify.apideck.com/vault/authorize/${serviceId}/abc`,
  revoke_url: null,
  ...overrides,
});

const setupFetchMock = (
  serviceId: string,
  connectionOverrides: Record<string, any>
) => {
  const connection = makeConnection(serviceId, connectionOverrides);
  const listResponse = {
    status_code: 200,
    status: 'OK',
    data: [connection],
  };
  const detailResponse = {
    status_code: 200,
    status: 'OK',
    data: connection,
  };

  (window.fetch as any).mockImplementation((url: string) => {
    if (
      url ===
      `https://unify.apideck.com/vault/connections/ecommerce/${serviceId}`
    ) {
      return { json: async () => detailResponse };
    }

    if (url.includes('/config')) {
      return { json: async () => CONFIG };
    }

    return {
      ok: true,
      status: 200,
      json: async () => listResponse,
    };
  });
};

describe('Authorize button visibility', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => setupIntersectionObserverMock());
  afterEach(cleanup);

  it('should show Authorize button for custom auth type with oauth_grant_type', async () => {
    setupFetchMock('custom-oauth-connector', {
      auth_type: 'custom',
      oauth_grant_type: 'client_credentials',
      enabled: true,
      state: 'added',
    });

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId="custom-oauth-connector"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });
  });

  it('should NOT show Authorize button for custom auth type without oauth_grant_type', async () => {
    setupFetchMock('custom-plain-connector', {
      auth_type: 'custom',
      enabled: true,
      state: 'added',
    });

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId="custom-plain-connector"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Test Connector')).toBeInTheDocument();
    });
    expect(screen.queryByText('Authorize')).not.toBeInTheDocument();
  });

  it('should still show Authorize button for oauth2 auth type', async () => {
    setupFetchMock('oauth2-connector', {
      auth_type: 'oauth2',
      enabled: true,
      state: 'added',
    });

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId="oauth2-connector"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });
  });
});
