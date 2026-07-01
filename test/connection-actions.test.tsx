import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';
import { ToastProvider } from '@apideck/components';
import { act } from 'react-dom/test-utils';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { mutate as globalMutate, SWRConfig } from 'swr';
import {
  ConnectionsProvider,
  useConnections,
} from '../src/utils/useConnections';
import { useConnectionActions } from '../src/utils/connectionActions';
import { generateNonce } from '../src/utils/oauthCsrf';
import '../src/utils/i18n';

const SERVICE_ID = 'shopify';
const UNIFIED_API = 'ecommerce';
const UNIFY_BASE_URL = 'https://unify.apideck.com';
const CONNECTIONS_URL = `${UNIFY_BASE_URL}/vault/connections`;
const AUTHORIZE_URL_BASE = `${CONNECTIONS_URL}/authorize/${SERVICE_ID}/abc?redirect_uri=http://localhost:3000`;

const makeConnection = (overrides: Record<string, any> = {}) => ({
  id: `${UNIFIED_API}+${SERVICE_ID}`,
  service_id: SERVICE_ID,
  unified_api: UNIFIED_API,
  name: 'Shopify',
  icon: 'https://example.com/icon.png',
  enabled: true,
  state: 'callable',
  auth_type: 'oauth2',
  authorize_url: AUTHORIZE_URL_BASE,
  revoke_url: null,
  form_fields: [],
  configurable_resources: [],
  resource_schema_support: [],
  resource_settings_support: [],
  settings_required_for_authorization: [],
  ...overrides,
});

interface HostProps {
  url: string;
  buildUrlAtClick?: (serviceId: string, base: string) => string;
  onConnectionChange?: (connection: any) => void;
}

const Host = ({ url, buildUrlAtClick, onConnectionChange }: HostProps) => {
  const { handleRedirect } = useConnectionActions();
  const { selectedConnection } = useConnections();
  return (
    <>
      <span data-testid="state">{selectedConnection?.state}</span>
      <button
        onClick={() => {
          const finalUrl = buildUrlAtClick
            ? buildUrlAtClick(SERVICE_ID, url)
            : url;
          handleRedirect(finalUrl, onConnectionChange);
        }}
      >
        Trigger
      </button>
    </>
  );
};

const renderHost = (
  hostProps: HostProps,
  connectionOverrides: Record<string, any> = {}
) => {
  const connection = makeConnection(connectionOverrides);
  const listResponse = { status_code: 200, status: 'OK', data: [connection] };
  const detailResponse = { status_code: 200, status: 'OK', data: connection };
  const tokenResponse = {
    status_code: 200,
    status: 'OK',
    data: { token: 'tok' },
  };
  const confirmResponse = {
    status_code: 200,
    status: 'OK',
    data: { confirmed: true },
  };

  const calls: { url: string; init?: any }[] = [];
  (window.fetch as any).mockImplementation((url: string, init?: any) => {
    calls.push({ url, init });
    if (url.endsWith('/confirm') && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => confirmResponse };
    }
    if (url.endsWith('/token') && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => tokenResponse };
    }
    if (url === `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`) {
      return { ok: true, status: 200, json: async () => detailResponse };
    }
    return { ok: true, status: 200, json: async () => listResponse };
  });

  return {
    calls,
    ...render(
      <ToastProvider>
        <ConnectionsProvider
          appId="app-id"
          consumerId="consumer-id"
          token="jwt-token"
          isOpen
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
          unifyBaseUrl={UNIFY_BASE_URL}
          onClose={() => undefined}
          onConnectionChange={hostProps.onConnectionChange}
        >
          <Host {...hostProps} />
        </ConnectionsProvider>
      </ToastProvider>
    ),
  };
};

describe('useConnectionActions.handleRedirect OAuth CSRF flow', () => {
  let fakeChild: { closed: boolean; close: jest.Mock };
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    fakeChild = { closed: false, close: jest.fn() };
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(async () => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
    // Clear the shared SWR cache so connection state doesn't leak between tests.
    await globalMutate(
      `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`,
      undefined,
      false
    );
    await globalMutate(
      `${CONNECTIONS_URL}?api=${UNIFIED_API}`,
      undefined,
      false
    );
  });

  const triggerAndOpen = async () => {
    const result = renderHost({
      url: AUTHORIZE_URL_BASE,
      buildUrlAtClick: (_serviceId, base) => {
        const nonce = generateNonce();
        const u = new URL(base);
        u.searchParams.append('nonce', nonce);
        return u.href;
      },
    });

    await act(async () => {
      fireEvent.click(result.getByText('Trigger'));
    });

    // Allow effects (selectedConnection auto-set in single-connection mode) to flush
    await act(async () => {
      await Promise.resolve();
    });

    return result;
  };

  it('appends &nonce= to the authorize URL', async () => {
    await triggerAndOpen();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0] as string;
    expect(openedUrl).toContain('nonce=');
    const nonceFromUrl = new URL(openedUrl).searchParams.get('nonce');
    expect(nonceFromUrl).toBeTruthy();
  });

  it('on oauth_complete with valid nonce: POSTs to /confirm', async () => {
    const { calls } = await triggerAndOpen();

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
      const c = calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(c).toBeDefined();
      expect(c?.init?.method).toBe('POST');
      expect(JSON.parse(c?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });
  });

  it('on oauth_error: shows toast and does NOT call /confirm', async () => {
    const result = await triggerAndOpen();

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
      expect(result.queryByText('User denied consent')).toBeInTheDocument();
    });

    const confirmCall = result.calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('ignores postMessage with foreign serviceId', async () => {
    const { calls } = await triggerAndOpen();

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

    await act(async () => {
      await Promise.resolve();
    });

    const confirmCall = calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('on oauth_complete with an arbitrary nonce: still POSTs to /confirm', async () => {
    const { calls } = await triggerAndOpen();

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
      const c = calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(c).toBeDefined();
      expect(c?.init?.method).toBe('POST');
      expect(JSON.parse(c?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });
  });

  it('falls back to mutate after 1000ms grace when child closes with no postMessage', async () => {
    jest.useFakeTimers();
    const { calls, getByText } = renderHost({
      url: AUTHORIZE_URL_BASE,
      buildUrlAtClick: (_serviceId, base) => {
        const nonce = generateNonce();
        const u = new URL(base);
        u.searchParams.append('nonce', nonce);
        return u.href;
      },
    });

    await act(async () => {
      fireEvent.click(getByText('Trigger'));
    });

    fakeChild.closed = true;

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    let confirmCall = calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();

    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    confirmCall = calls.find((c) => c.url.endsWith('/confirm'));
    expect(confirmCall).toBeUndefined();
  });

  it('shows a toast when the popup is blocked', async () => {
    openSpy.mockImplementation(() => null as unknown as Window);
    const { getByText } = await triggerAndOpen();

    await waitFor(() => {
      expect(getByText('Popup blocked')).toBeInTheDocument();
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('emits onConnectionChange once (not twice) when re-authorizing authorized -> callable', async () => {
    let confirmed = false;
    const onConnectionChange = jest.fn();
    const base = makeConnection({ state: 'authorized' });
    const detailUrl = `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`;
    const calls: { url: string; init?: any }[] = [];
    (window.fetch as any).mockImplementation((url: string, init?: any) => {
      calls.push({ url, init });
      if (url.endsWith('/confirm') && init?.method === 'POST') {
        confirmed = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status_code: 200, data: { confirmed: true } }),
        };
      }
      if (url === detailUrl) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status_code: 200,
            data: { ...base, state: confirmed ? 'callable' : 'authorized' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status_code: 200, data: [base] }),
      };
    });

    const { getByText, getByTestId } = render(
      // Isolated SWR cache so this test's authorized->callable transition is not
      // polluted by connection state cached by sibling tests.
      <SWRConfig value={{ provider: () => new Map() }}>
        <ToastProvider>
          <ConnectionsProvider
            appId="app-id"
            consumerId="consumer-id"
            token="jwt-token"
            isOpen
            unifiedApi={UNIFIED_API}
            serviceId={SERVICE_ID}
            unifyBaseUrl={UNIFY_BASE_URL}
            onClose={() => undefined}
            onConnectionChange={onConnectionChange}
          >
            <Host
              url={AUTHORIZE_URL_BASE}
              buildUrlAtClick={(_serviceId, b) => {
                const u = new URL(b);
                u.searchParams.append('nonce', generateNonce());
                return u.href;
              }}
              onConnectionChange={onConnectionChange}
            />
          </ConnectionsProvider>
        </ToastProvider>
      </SWRConfig>
    );

    // Wait until the provider has selected + loaded the connection as `authorized`.
    await waitFor(() =>
      expect(getByTestId('state').textContent).toBe('authorized')
    );

    await act(async () => {
      fireEvent.click(getByText('Trigger'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_complete',
            nonce: 'n',
            confirmToken: 't',
            serviceId: SERVICE_ID,
            success: true,
          },
          origin: 'https://vault.apideck.com',
        })
      );
    });

    await waitFor(() =>
      expect(onConnectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'callable' })
      )
    );
    // Exactly one callable emit: connectionActions skips the entry-into-callable
    // (the provider effect owns it), so the consumer is not notified twice.
    const callableCalls = onConnectionChange.mock.calls.filter(
      ([c]) => c?.state === 'callable'
    );
    expect(callableCalls).toHaveLength(1);
  });
});
