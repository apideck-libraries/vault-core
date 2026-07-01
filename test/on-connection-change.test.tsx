import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { mutate as globalMutate } from 'swr';

import { setupIntersectionObserverMock } from './mock';
import { Vault } from '../src/components/Vault';

const UNIFIED_API = 'ecommerce';
const SERVICE_ID = 'shopify';
const CONNECTIONS_URL = 'https://unify.apideck.com/vault/connections';
const DETAIL_URL = `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`;

const baseConnection = (overrides: Record<string, any> = {}) => ({
  id: `${UNIFIED_API}+${SERVICE_ID}`,
  name: 'Shopify',
  unified_api: UNIFIED_API,
  service_id: SERVICE_ID,
  auth_type: 'oauth2',
  enabled: true,
  state: 'added',
  form_fields: [],
  configurable_resources: [],
  resource_schema_support: [],
  resource_settings_support: [],
  settings_required_for_authorization: [],
  authorize_url: `https://unify.apideck.com/vault/authorize/${SERVICE_ID}/abc`,
  revoke_url: null,
  ...overrides,
});

// `setState` flips what the detail endpoint returns, so a test can drive the
// connection into `callable` WITHOUT going through the AuthorizeButton handler
// (mirroring SWR revalidate-on-focus after the popup closes). That is what makes
// the first test a valid RED: before the fix, nothing emits `callable` here.
const setupMock = (initialState = 'added') => {
  let state = initialState;
  (window.fetch as any).mockImplementation((url: string) => {
    if (url === DETAIL_URL) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status_code: 200,
          data: baseConnection({ state }),
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status_code: 200,
        data: [baseConnection({ state })],
      }),
    };
  });
  return {
    setState: (s: string) => {
      state = s;
    },
  };
};

describe('onConnectionChange callable transition (GH-148)', () => {
  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  const renderVault = async (onConnectionChange: jest.Mock) => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
          onConnectionChange={onConnectionChange}
        />
      );
    });
    return screen;
  };

  it('emits onConnectionChange(callable) on transition to callable, even as the button unmounts', async () => {
    const { setState } = setupMock('added');
    const onConnectionChange = jest.fn();
    const screen = await renderVault(onConnectionChange);

    await waitFor(() =>
      expect(screen.getByText('Authorize')).toBeInTheDocument()
    );

    // Backend confirms the connection; revalidation picks up `callable`.
    setState('callable');
    await act(async () => {
      await globalMutate(DETAIL_URL);
    });

    await waitFor(() =>
      expect(onConnectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'callable' })
      )
    );
    const callableCalls = onConnectionChange.mock.calls.filter(
      ([c]) => c?.state === 'callable'
    );
    expect(callableCalls).toHaveLength(1);
    expect(screen.queryByText('Authorize')).not.toBeInTheDocument();
  });

  it('does NOT emit callable when opening an already-callable connection', async () => {
    setupMock('callable');
    const onConnectionChange = jest.fn();
    await renderVault(onConnectionChange);

    await act(async () => {
      await Promise.resolve();
    });

    const callableCalls = onConnectionChange.mock.calls.filter(
      ([c]) => c?.state === 'callable'
    );
    expect(callableCalls).toHaveLength(0);
  });
});
