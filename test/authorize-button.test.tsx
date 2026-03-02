import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { setupIntersectionObserverMock } from './mock';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { CONFIG } from './responses/config';

const mockAddToast = jest.fn();
jest.mock('@apideck/components', () => ({
  ...(jest.requireActual('@apideck/components') as any),
  useToast: () => ({ addToast: mockAddToast }),
}));

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

describe('OAuth confirm flow', () => {
  let mockChild: { closed: boolean };
  const serviceId = 'oauth2-confirm-connector';

  const setupConfirmFetchMock = (
    confirmResponse?: { ok: boolean; status: number } | 'reject'
  ) => {
    const connection = makeConnection(serviceId, {
      auth_type: 'oauth2',
      enabled: true,
      state: 'added',
    });
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
      if (url.includes('/vault/oauth/confirm')) {
        if (confirmResponse === 'reject') {
          return Promise.reject(new Error('Network error'));
        }
        return {
          ok: confirmResponse?.ok ?? true,
          status: confirmResponse?.status ?? 200,
          json: async () => ({}),
        };
      }

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

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
    mockChild = { closed: false };
    jest.spyOn(window, 'open').mockReturnValue(mockChild as any);
    mockAddToast.mockClear();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('adds message event listener when authorize popup opens', async () => {
    setupConfirmFetchMock();
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'message'
    );
    expect(messageListenerCalls).toHaveLength(1);
  });

  it('calls confirm endpoint when oauth-confirm message is received', async () => {
    setupConfirmFetchMock();

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      const fetchCalls = (window.fetch as jest.Mock).mock.calls;
      const confirmCall = fetchCalls.find(([url]: [string]) =>
        url.includes('/vault/oauth/confirm')
      );
      expect(confirmCall).toBeDefined();
      expect(confirmCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ confirm_token: 'test-uuid' }),
        })
      );
    });
  });

  it('shows error toast when confirm endpoint returns 403', async () => {
    setupConfirmFetchMock({ ok: false, status: 403 });

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('shows error toast when confirm endpoint fails with network error', async () => {
    setupConfirmFetchMock('reject');

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('removes message event listener when popup closes', async () => {
    setupConfirmFetchMock();
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    mockChild.closed = true;

    await waitFor(
      () => {
        const removeMessageCalls = removeEventListenerSpy.mock.calls.filter(
          ([event]) => event === 'message'
        );
        expect(removeMessageCalls).toHaveLength(1);
      },
      { timeout: 2000 }
    );
  });

  it('proceeds normally when no oauth-confirm message is received', async () => {
    setupConfirmFetchMock();
    const connectionDetailUrl = `https://unify.apideck.com/vault/connections/ecommerce/${serviceId}`;

    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi="ecommerce"
          serviceId={serviceId}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    const callsBefore = (window.fetch as jest.Mock).mock.calls.filter(
      ([url]: [string]) => url === connectionDetailUrl
    ).length;

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    // Close popup without sending any message
    mockChild.closed = true;

    await waitFor(
      () => {
        const callsAfter = (window.fetch as jest.Mock).mock.calls.filter(
          ([url]: [string]) => url === connectionDetailUrl
        ).length;
        expect(callsAfter).toBeGreaterThan(callsBefore);
      },
      { timeout: 2000 }
    );
  });
});
