import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';
import { ToastProvider } from '@apideck/components';
import { act } from 'react-dom/test-utils';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { ConnectionsProvider } from '../src/utils/useConnections';
import { useConnectionActions } from '../src/utils/connectionActions';
import { generateNonce } from '../src/utils/oauthCsrf';
import {
  CALLABLE_POLL_BUDGET_MS,
  CALLABLE_POLL_INTERVAL_MS,
  LAUNCH_READY_TIMEOUT_MS,
} from '../src/constants/oauthGrantHandoff';
import { OAUTH_LAUNCH_PATH, REDIRECT_URL } from '../src/constants/urls';
import '../src/utils/i18n';

const SERVICE_ID = 'shopify';
const UNIFIED_API = 'ecommerce';
const UNIFY_BASE_URL = 'https://unify.apideck.com';
const CONNECTIONS_URL = `${UNIFY_BASE_URL}/vault/connections`;
const AUTHORIZE_URL_BASE = `${CONNECTIONS_URL}/authorize/${SERVICE_ID}/abc?redirect_uri=http://localhost:3000`;
const DETAIL_URL = `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`;
const GRANT_URL = `${DETAIL_URL}/grant`;

// No SessionProvider is mounted in this harness, so the session has no
// redirect_uri — the launch origin falls back to the REDIRECT_URL origin
// (https://vault.apideck.com).
const LAUNCH_ORIGIN = new URL(REDIRECT_URL).origin;
const LAUNCH_URL = `${LAUNCH_ORIGIN}${OAUTH_LAUNCH_PATH}?service_id=${SERVICE_ID}`;
const WINDOW_FEATURES =
  'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0';

type FakeChild = {
  closed: boolean;
  close: jest.Mock;
  postMessage: jest.Mock;
  location: { href: string };
};

const makeFakeChild = (): FakeChild => ({
  closed: false,
  close: jest.fn(),
  postMessage: jest.fn(),
  location: { href: '' },
});

const dispatchLaunchReady = async (child: FakeChild) => {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'oauth_launch_ready' },
        origin: LAUNCH_ORIGIN,
        source: child as any,
      })
    );
  });
};

// Complete the opener -> popup handshake and return the legacy authorize URL
// (containing the nonce) that the widget posted to the child.
const completeHandshake = async (child: FakeChild) => {
  await dispatchLaunchReady(child);
  await waitFor(() => {
    expect(child.postMessage).toHaveBeenCalled();
  });
  return child.postMessage.mock.calls[0][0].authorizeUrl as string;
};

const dispatchComplete = async (nonce: string) => {
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
};

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
  // Phase 5 adds a third `grantHandoff` param to handleRedirect; re-authorize
  // call sites pass it, revoke call sites do not.
  withGrantHandoff?: boolean;
  onConnectionChange?: (connection: any) => any;
}

const Host = ({
  url,
  buildUrlAtClick,
  withGrantHandoff,
  onConnectionChange,
}: HostProps) => {
  const { handleRedirect } = useConnectionActions();
  return (
    <button
      onClick={() => {
        const finalUrl = buildUrlAtClick
          ? buildUrlAtClick(SERVICE_ID, url)
          : url;
        if (withGrantHandoff) {
          // Phase 5 adds this param — cast until the signature gains it.
          (handleRedirect as any)(finalUrl, onConnectionChange, {
            unifiedApi: UNIFIED_API,
            serviceId: SERVICE_ID,
          });
        } else {
          handleRedirect(finalUrl, onConnectionChange);
        }
      }}
    >
      Trigger
    </button>
  );
};

interface MockOptions {
  // 'success' (default) responds with a grant; 'failure' responds non-2xx;
  // 'pending' leaves the request unresolved until `releaseGrant` is invoked.
  grant?: 'success' | 'failure' | 'pending';
  // Initial connection state served by the detail endpoint (mutable per test
  // via the returned `mockData.detailState` field).
  detailState?: string;
}

const renderHost = (
  hostProps: HostProps,
  connectionOverrides: Record<string, any> = {},
  options: MockOptions = {}
) => {
  const connection = makeConnection(connectionOverrides);
  const listResponse = { status_code: 200, status: 'OK', data: [connection] };
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
  const grantResponse = {
    status_code: 200,
    status: 'OK',
    data: { grant: 'grant-abc', expires_in: 300 },
  };

  const calls: { url: string; init?: any }[] = [];
  const mockData = {
    calls,
    // Mutable: tests flip this to drive the post-close callable poll.
    detailState: options.detailState ?? ((connection as any).state as string),
    releaseGrant: undefined as (() => void) | undefined,
  };

  (window.fetch as any).mockImplementation((url: string, init?: any) => {
    calls.push({ url, init });
    if (url === GRANT_URL && init?.method === 'POST') {
      if (options.grant === 'failure') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'grant unavailable' }),
        };
      }
      if (options.grant === 'pending') {
        return new Promise((resolve) => {
          mockData.releaseGrant = () =>
            resolve({ ok: true, status: 200, json: async () => grantResponse });
        });
      }
      return { ok: true, status: 200, json: async () => grantResponse };
    }
    if (url.endsWith('/confirm') && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => confirmResponse };
    }
    if (url.endsWith('/token') && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => tokenResponse };
    }
    if (url === `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status_code: 200,
          status: 'OK',
          data: { ...connection, state: mockData.detailState },
        }),
      };
    }
    return { ok: true, status: 200, json: async () => listResponse };
  });

  return {
    calls,
    mockData,
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
        >
          <Host {...hostProps} />
        </ConnectionsProvider>
      </ToastProvider>
    ),
  };
};

describe('useConnectionActions.handleRedirect OAuth CSRF flow', () => {
  let fakeChild: FakeChild;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    fakeChild = makeFakeChild();
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const triggerAndOpen = async () => {
    // Re-authorize flow: Phase 5 passes the grantHandoff param here.
    const result = renderHost({
      url: AUTHORIZE_URL_BASE,
      buildUrlAtClick: (_serviceId, base) => {
        const nonce = generateNonce();
        const u = new URL(base);
        u.searchParams.append('nonce', nonce);
        return u.href;
      },
      withGrantHandoff: true,
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
    // Phase 5: the popup opens on the launch URL; the legacy authorize URL
    // (carrying the nonce) is delivered to the child via the handshake.
    const authorizeUrl = await completeHandshake(fakeChild);
    expect(authorizeUrl).toContain('nonce=');
    const nonceFromUrl = new URL(authorizeUrl).searchParams.get('nonce');
    expect(nonceFromUrl).toBeTruthy();
  });

  it('on oauth_complete with valid nonce: POSTs to /confirm', async () => {
    const { calls } = await triggerAndOpen();

    // Phase 5: the opened URL is the launch URL; obtain the legacy authorize
    // URL (with nonce) by completing the handshake.
    const authorizeUrl = await completeHandshake(fakeChild);
    const nonce = new URL(authorizeUrl).searchParams.get('nonce') as string;

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

    // Phase 5: read the nonce from the authorize URL posted to the child.
    const authorizeUrl = await completeHandshake(fakeChild);
    const nonce = new URL(authorizeUrl).searchParams.get('nonce') as string;

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
      withGrantHandoff: true,
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

  // --- Storage-partitioned iframe (GH-9546) ---------------------------------
  // handleRedirect must confirm even when the embedding iframe has no usable
  // sessionStorage (writes dropped/throw, reads null). Guards against
  // reintroducing a storage dependency in the redirect -> /confirm path.

  const renderTriggerHost = () =>
    renderHost({
      url: AUTHORIZE_URL_BASE,
      buildUrlAtClick: (_serviceId, base) => {
        const u = new URL(base);
        u.searchParams.append('nonce', generateNonce());
        return u.href;
      },
      withGrantHandoff: true,
    });

  const clickAndComplete = async (
    result: ReturnType<typeof renderTriggerHost>
  ) => {
    await act(async () => {
      fireEvent.click(result.getByText('Trigger'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(openSpy).toHaveBeenCalledTimes(1);

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
      const c = result.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(c).toBeDefined();
    });
  };

  it('still POSTs /confirm when sessionStorage throws (denied storage)', async () => {
    const result = renderTriggerHost();
    // Let the single-connection auto-select effect settle before severing storage.
    await act(async () => {
      await Promise.resolve();
    });

    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Access is denied.', 'SecurityError');
      });
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Access is denied.', 'SecurityError');
      });

    await clickAndComplete(result);

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('still POSTs /confirm when sessionStorage is severed (writes dropped, reads null)', async () => {
    const result = renderTriggerHost();
    await act(async () => {
      await Promise.resolve();
    });

    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => undefined);
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(null);

    await clickAndComplete(result);

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });
});

describe('useConnectionActions.handleRedirect OAuth grant handoff flow', () => {
  let fakeChild: FakeChild;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    fakeChild = makeFakeChild();
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const appendNonce = (_serviceId: string, base: string) => {
    const u = new URL(base);
    u.searchParams.append('nonce', generateNonce());
    return u.href;
  };

  const renderHandoffHost = (
    options: MockOptions = {},
    hostExtras: Partial<HostProps> = {}
  ) =>
    renderHost(
      {
        url: AUTHORIZE_URL_BASE,
        buildUrlAtClick: appendNonce,
        withGrantHandoff: true,
        ...hostExtras,
      },
      {},
      options
    );

  const clickTrigger = async (result: { getByText: any }) => {
    await act(async () => {
      fireEvent.click(result.getByText('Trigger'));
    });
    // Allow effects (selectedConnection auto-set in single-connection mode)
    // to flush.
    await act(async () => {
      await Promise.resolve();
    });
  };

  const detailFetchCount = (calls: { url: string; init?: any }[]) =>
    calls.filter((c) => c.url === DETAIL_URL && c.init?.method === undefined)
      .length;

  it('opens the popup to the launch URL synchronously on click, before the grant mint resolves', async () => {
    const result = renderHandoffHost({ grant: 'pending' });

    await clickTrigger(result);

    // The popup must open synchronously on the launch URL — the grant mock is
    // still unresolved here (it only resolves via releaseGrant).
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(LAUNCH_URL, '_blank', WINDOW_FEATURES);

    const grantCall = result.calls.find((c) => c.url === GRANT_URL);
    expect(grantCall).toBeDefined();
    expect(result.mockData.releaseGrant).toBeDefined();
  });

  it('still mints the grant with a POST to .../grant carrying the JWT headers', async () => {
    const result = renderHandoffHost();

    await clickTrigger(result);

    await waitFor(() => {
      const grantCall = result.calls.find((c) => c.url === GRANT_URL);
      expect(grantCall).toBeDefined();
      expect(grantCall?.init?.method).toBe('POST');
      expect(grantCall?.init?.headers).toMatchObject({
        Authorization: 'Bearer jwt-token',
        'X-APIDECK-APP-ID': 'app-id',
        'X-APIDECK-CONSUMER-ID': 'consumer-id',
      });
    });
  });

  it('on oauth_launch_ready from the child at the launch origin: posts oauth_launch_start with grant + legacy authorize URL (containing &nonce=) and explicit targetOrigin', async () => {
    const result = renderHandoffHost();

    await clickTrigger(result);
    await dispatchLaunchReady(fakeChild);

    await waitFor(() => {
      expect(fakeChild.postMessage).toHaveBeenCalledTimes(1);
    });

    const [message, targetOrigin] = fakeChild.postMessage.mock.calls[0];
    expect(targetOrigin).toBe(LAUNCH_ORIGIN);
    expect(message).toMatchObject({
      type: 'oauth_launch_start',
      grant: 'grant-abc',
    });
    expect(message.authorizeUrl).toContain(
      `${CONNECTIONS_URL}/authorize/${SERVICE_ID}/abc`
    );
    expect(message.authorizeUrl).toContain('nonce=');
    expect(
      new URL(message.authorizeUrl).searchParams.get('nonce')
    ).toBeTruthy();
    // The child was never navigated: the grant travels via postMessage only.
    expect(fakeChild.location.href).toBe('');
  });

  it('when the grant mint returns non-2xx: navigates the popup to the legacy authorize URL and the legacy oauth_complete → /confirm path still works end-to-end', async () => {
    const result = renderHandoffHost({ grant: 'failure' });

    await clickTrigger(result);
    await dispatchLaunchReady(fakeChild);

    await waitFor(() => {
      expect(fakeChild.location.href).not.toBe('');
    });
    const legacyUrl = fakeChild.location.href;
    expect(legacyUrl).toContain(
      `${CONNECTIONS_URL}/authorize/${SERVICE_ID}/abc`
    );
    const nonce = new URL(legacyUrl).searchParams.get('nonce') as string;
    expect(nonce).toBeTruthy();
    expect(fakeChild.postMessage).not.toHaveBeenCalled();

    await dispatchComplete(nonce);

    await waitFor(() => {
      const confirmCall = result.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(confirmCall).toBeDefined();
      expect(confirmCall?.init?.method).toBe('POST');
      expect(JSON.parse(confirmCall?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });
  });

  it('when no oauth_launch_ready arrives within LAUNCH_READY_TIMEOUT_MS: navigates the popup to the legacy authorize URL', async () => {
    jest.useFakeTimers();
    const result = renderHandoffHost();

    await clickTrigger(result);

    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
    });

    expect(fakeChild.location.href).toContain(
      `${CONNECTIONS_URL}/authorize/${SERVICE_ID}/abc`
    );
    expect(
      new URL(fakeChild.location.href).searchParams.get('nonce')
    ).toBeTruthy();
    expect(fakeChild.postMessage).not.toHaveBeenCalled();
  });

  it('legacy oauth_complete received after a completed handoff handshake: still POSTs /confirm exactly once (popup-side fallback; no double confirm with the poller)', async () => {
    jest.useFakeTimers();
    const result = renderHandoffHost();

    await clickTrigger(result);
    const authorizeUrl = await completeHandshake(fakeChild);
    const nonce = new URL(authorizeUrl).searchParams.get('nonce') as string;

    await dispatchComplete(nonce);

    await waitFor(() => {
      expect(
        result.calls.filter((c) => c.url.endsWith('/confirm')).length
      ).toBe(1);
    });

    // The popup closes afterwards — the completed flag keeps the close-poller
    // (and the callable poll) from double reporting.
    fakeChild.closed = true;
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    const ticks = CALLABLE_POLL_BUDGET_MS / CALLABLE_POLL_INTERVAL_MS;
    for (let i = 0; i <= ticks; i++) {
      await act(async () => {
        jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      });
    }

    expect(result.calls.filter((c) => c.url.endsWith('/confirm')).length).toBe(
      1
    );
    expect(result.queryByText(/not completed/i)).not.toBeInTheDocument();
  });

  it('on popup close after handoff without oauth_complete: polls the connection detail URL and, on state=callable, mutates and fires onConnectionChange without an error toast', async () => {
    jest.useFakeTimers();
    const onConnectionChange = jest.fn();
    const result = renderHandoffHost(
      { detailState: 'pending_confirmation' },
      { onConnectionChange }
    );

    await clickTrigger(result);
    await completeHandshake(fakeChild);
    onConnectionChange.mockClear();

    fakeChild.closed = true;
    // 500ms close poll + 1000ms grace, as today.
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Still pending_confirmation: no blind mutate success — the widget must
    // poll the detail URL instead of reporting success immediately.
    expect(onConnectionChange).not.toHaveBeenCalled();

    const fetchesBeforePoll = detailFetchCount(result.calls);
    await act(async () => {
      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
    });
    expect(detailFetchCount(result.calls)).toBeGreaterThan(fetchesBeforePoll);

    result.mockData.detailState = 'callable';
    await act(async () => {
      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'callable' })
      );
    });
    expect(result.queryByText(/not completed/i)).not.toBeInTheDocument();
  });

  it('on popup close with the connection stuck pending_confirmation: shows an actionable error toast after the poll budget, never a silent success', async () => {
    jest.useFakeTimers();
    const onConnectionChange = jest.fn();
    const result = renderHandoffHost(
      { detailState: 'pending_confirmation' },
      { onConnectionChange }
    );

    await clickTrigger(result);
    await completeHandshake(fakeChild);
    onConnectionChange.mockClear();

    fakeChild.closed = true;
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    const ticks = CALLABLE_POLL_BUDGET_MS / CALLABLE_POLL_INTERVAL_MS;
    for (let i = 0; i <= ticks; i++) {
      await act(async () => {
        jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      });
    }

    // Actionable error toast — never a silent fake success.
    expect(result.getByText(/not completed/i)).toBeInTheDocument();
    expect(onConnectionChange).not.toHaveBeenCalled();
    expect(
      result.calls.find((c) => c.url.endsWith('/confirm'))
    ).toBeUndefined();
  });

  it('on oauth_error: toasts, does not confirm, and does not start the callable poll', async () => {
    jest.useFakeTimers();
    const result = renderHandoffHost();

    await clickTrigger(result);

    // The handoff flow opened the popup on the launch URL.
    expect(openSpy).toHaveBeenCalledWith(LAUNCH_URL, '_blank', WINDOW_FEATURES);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'oauth_error',
            error: 'access_denied',
            errorDescription: 'User denied consent',
            serviceId: SERVICE_ID,
          },
          origin: LAUNCH_ORIGIN,
        })
      );
    });

    await waitFor(() => {
      expect(result.queryByText('User denied consent')).toBeInTheDocument();
    });

    const fetchesAfterError = detailFetchCount(result.calls);

    fakeChild.closed = true;
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      });
    }

    // No callable poll started after the grace window.
    expect(detailFetchCount(result.calls)).toBe(fetchesAfterError);
    expect(
      result.calls.find((c) => c.url.endsWith('/confirm'))
    ).toBeUndefined();
  });

  it('revoke/disconnect: opens the revoke URL directly — no grant mint, no handshake listener, no callable poll', async () => {
    jest.useFakeTimers();
    const revokeUrl = `${UNIFY_BASE_URL}/vault/revoke/${SERVICE_ID}/abc?redirect_uri=http://localhost:3000`;
    // No grantHandoff param at revoke call sites — today's behavior
    // byte-for-byte.
    const result = renderHost({ url: revokeUrl });

    await act(async () => {
      fireEvent.click(result.getByText('Trigger'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(revokeUrl, '_blank', WINDOW_FEATURES);

    // No grant mint.
    expect(result.calls.find((c) => c.url === GRANT_URL)).toBeUndefined();

    // A launch-ready message is ignored — no handshake listener is armed.
    await dispatchLaunchReady(fakeChild);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fakeChild.postMessage).not.toHaveBeenCalled();
    expect(fakeChild.location.href).toBe('');

    // On close, today's single mutate may run after the grace window, but no
    // repeated callable poll may start.
    fakeChild.closed = true;
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    const fetchesAfterGrace = detailFetchCount(result.calls);
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      });
    }
    expect(detailFetchCount(result.calls)).toBe(fetchesAfterGrace);
  });
});
