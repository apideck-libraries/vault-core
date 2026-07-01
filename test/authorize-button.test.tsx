import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { setupIntersectionObserverMock } from './mock';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

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

const SERVICE_ID = 'shopify';
const UNIFIED_API = 'ecommerce';
const CONNECTIONS_URL = 'https://unify.apideck.com/vault/connections';

const setupOAuthFetchMock = (
  serviceId: string,
  overrides: Record<string, any> = {}
) => {
  const connection = makeConnection(serviceId, {
    auth_type: 'oauth2',
    enabled: true,
    state: 'added',
    ...overrides,
  });
  const listResponse = { status_code: 200, status: 'OK', data: [connection] };
  const detailResponse = { status_code: 200, status: 'OK', data: connection };
  const confirmResponse = {
    status_code: 200,
    status: 'OK',
    data: { confirmed: true },
  };

  const calls: { url: string; init?: any }[] = [];
  (window.fetch as any).mockImplementation((url: string, init?: any) => {
    calls.push({ url, init });
    if (url.endsWith('/confirm') && init?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => confirmResponse,
      };
    }
    if (url === `${CONNECTIONS_URL}/ecommerce/${serviceId}`) {
      return { ok: true, status: 200, json: async () => detailResponse };
    }
    if (url.includes('/config')) {
      return { ok: true, status: 200, json: async () => CONFIG };
    }
    return { ok: true, status: 200, json: async () => listResponse };
  });

  return { calls };
};

describe('Authorize button OAuth CSRF flow', () => {
  let fakeChild: { closed: boolean; close: jest.Mock };
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
    fakeChild = { closed: false, close: jest.fn() };
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const renderAndClickAuthorize = async (
    overrides: Record<string, any> = {}
  ) => {
    const mockData = setupOAuthFetchMock(SERVICE_ID, overrides);
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    return { screen, mockData };
  };

  it('appends &nonce= to the authorize URL', async () => {
    await renderAndClickAuthorize();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0] as string;
    expect(openedUrl).toContain('nonce=');

    const url = new URL(openedUrl);
    const nonceFromUrl = url.searchParams.get('nonce');
    expect(nonceFromUrl).toBeTruthy();
  });

  it('on oauth_complete with valid nonce: POSTs to /confirm', async () => {
    const { mockData } = await renderAndClickAuthorize();

    const openedUrl = openSpy.mock.calls[0][0] as string;
    const nonce = new URL(openedUrl).searchParams.get('nonce') as string;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_complete',
            nonce,
            confirmToken: 'token-xyz',
            serviceId: SERVICE_ID,
            success: true,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    await waitFor(() => {
      const confirmCall = mockData.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(confirmCall).toBeDefined();
      expect(confirmCall?.init?.method).toBe('POST');
      expect(JSON.parse(confirmCall?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });
  });

  it('on oauth_error: shows toast and does NOT call /confirm', async () => {
    const { screen, mockData } = await renderAndClickAuthorize();

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_error',
            error: 'access_denied',
            errorDescription: 'User denied consent',
            serviceId: SERVICE_ID,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('User denied consent')).toBeInTheDocument();
    });

    const confirmCall = mockData.calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('ignores postMessage with foreign serviceId', async () => {
    const { mockData } = await renderAndClickAuthorize();

    const openedUrl = openSpy.mock.calls[0][0] as string;
    const nonce = new URL(openedUrl).searchParams.get('nonce') as string;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_complete',
            nonce,
            confirmToken: 'token-xyz',
            serviceId: 'some-other-service',
            success: true,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    // Allow microtasks to flush
    await act(async () => {
      await Promise.resolve();
    });

    const confirmCall = mockData.calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('on oauth_complete with an arbitrary nonce: still POSTs to /confirm', async () => {
    const { mockData } = await renderAndClickAuthorize();

    // The client no longer verifies the nonce, so any value still confirms.
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_complete',
            nonce: 'arbitrary-value',
            confirmToken: 'token-xyz',
            serviceId: SERVICE_ID,
            success: true,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    await waitFor(() => {
      const confirmCall = mockData.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(confirmCall).toBeDefined();
      expect(confirmCall?.init?.method).toBe('POST');
      expect(JSON.parse(confirmCall?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });
  });

  it('falls back to mutate after 1000ms grace when child closes with no postMessage', async () => {
    jest.useFakeTimers();
    const mockData = setupOAuthFetchMock(SERVICE_ID);

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
        />
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    // child closes
    fakeChild.closed = true;

    // Advance past 500ms poll
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    // No /confirm yet; we are within grace period
    let confirmCall = mockData.calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();

    // Advance past 1000ms grace
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    // Still no /confirm because no postMessage arrived; fallback mutate ran instead
    confirmCall = mockData.calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('does not call /confirm twice when child closes after a successful postMessage', async () => {
    jest.useFakeTimers();
    const mockData = setupOAuthFetchMock(SERVICE_ID);

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    const openedUrl = openSpy.mock.calls[0][0] as string;
    const nonce = new URL(openedUrl).searchParams.get('nonce') as string;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_complete',
            nonce,
            confirmToken: 'token-xyz',
            serviceId: SERVICE_ID,
            success: true,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    await waitFor(() => {
      const c = mockData.calls.find((c) => c.url.endsWith('/confirm'));
      expect(c).toBeDefined();
    });

    const confirmCallsBefore = mockData.calls.filter((c) =>
      c.url.endsWith('/confirm')
    ).length;

    fakeChild.closed = true;
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    const confirmCallsAfter = mockData.calls.filter((c) =>
      c.url.endsWith('/confirm')
    ).length;
    expect(confirmCallsAfter).toBe(confirmCallsBefore);
  });

  it('shows a toast and unsticks the button when the popup is blocked', async () => {
    openSpy.mockImplementation(() => null as unknown as Window);
    const { screen } = await renderAndClickAuthorize();

    await waitFor(() => {
      expect(screen.getByText('Popup blocked')).toBeInTheDocument();
    });

    // button is not stuck: a second click (a real gesture) re-opens the popup
    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});
