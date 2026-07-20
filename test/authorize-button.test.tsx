import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { setupIntersectionObserverMock } from './mock';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { CONFIG } from './responses/config';
import {
  CALLABLE_POLL_BUDGET_MS,
  CALLABLE_POLL_INTERVAL_MS,
  LAUNCH_READY_TIMEOUT_MS,
} from '../src/constants/oauthGrantHandoff';
import { OAUTH_LAUNCH_PATH, REDIRECT_URL } from '../src/constants/urls';

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

// The Vault test harness uses a non-JWT token ("token123"), so the decoded
// session is empty and `session.redirect_uri` is unset — the launch origin
// falls back to the REDIRECT_URL origin (https://vault.apideck.com).
const LAUNCH_ORIGIN = new URL(REDIRECT_URL).origin;
const LAUNCH_URL = `${LAUNCH_ORIGIN}${OAUTH_LAUNCH_PATH}?service_id=${SERVICE_ID}`;
const WINDOW_FEATURES =
  'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0';
const AUTHORIZE_URL_PREFIX = `https://unify.apideck.com/vault/authorize/${SERVICE_ID}/abc`;
const DETAIL_URL = `${CONNECTIONS_URL}/${UNIFIED_API}/${SERVICE_ID}`;

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

interface OAuthMockOptions {
  // 'success' (default) responds with a grant; 'failure' responds non-2xx;
  // 'pending' leaves the request unresolved until `releaseGrant` is invoked.
  grant?: 'success' | 'failure' | 'pending';
  // Initial connection state served by the detail endpoint (mutable per test
  // via the returned `detailState` field).
  detailState?: string;
}

const setupOAuthFetchMock = (
  serviceId: string,
  overrides: Record<string, any> = {},
  options: OAuthMockOptions = {}
) => {
  const connection = makeConnection(serviceId, {
    auth_type: 'oauth2',
    enabled: true,
    state: 'added',
    ...overrides,
  });
  const listResponse = { status_code: 200, status: 'OK', data: [connection] };
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
    if (url.endsWith('/grant') && init?.method === 'POST') {
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
      return {
        ok: true,
        status: 200,
        json: async () => confirmResponse,
      };
    }
    if (url === `${CONNECTIONS_URL}/ecommerce/${serviceId}`) {
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
    if (url.includes('/config')) {
      return { ok: true, status: 200, json: async () => CONFIG };
    }
    return { ok: true, status: 200, json: async () => listResponse };
  });

  return mockData;
};

describe('Authorize button OAuth CSRF flow', () => {
  let fakeChild: FakeChild;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
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
    // Phase 5: the popup opens on the launch URL; the legacy authorize URL
    // (carrying the nonce) is delivered to the child via the handshake.
    const authorizeUrl = await completeHandshake(fakeChild);
    expect(authorizeUrl).toContain('nonce=');

    const url = new URL(authorizeUrl);
    const nonceFromUrl = url.searchParams.get('nonce');
    expect(nonceFromUrl).toBeTruthy();
  });

  it('on oauth_complete with valid nonce: POSTs to /confirm', async () => {
    const { mockData } = await renderAndClickAuthorize();

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

    // Phase 5: force the ready-timeout fallback so the child is navigated to
    // the legacy authorize URL, then read the nonce from it.
    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
    });
    const openedUrl = fakeChild.location.href;
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

  // --- Storage-partitioned iframe (GH-9546) ---------------------------------
  // When Vault is embedded in a third-party iframe, sessionStorage is commonly
  // partitioned away: writes are dropped or throw, and reads return null. The
  // authorize -> /confirm path must not depend on it. These guard against
  // reintroducing any sessionStorage dependency (the example/iframe-test harness
  // reproduces the same two failure modes manually).

  const renderAndWaitForAuthorize = async () => {
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
    return { screen, mockData };
  };

  it('still opens the popup and POSTs /confirm when sessionStorage throws (denied storage)', async () => {
    const { screen, mockData } = await renderAndWaitForAuthorize();

    // Sever storage only after mount, simulating a storage-blocked iframe.
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

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });

    // Click handler no longer touches storage, so the popup still opens.
    expect(openSpy).toHaveBeenCalledTimes(1);

    await dispatchComplete('arbitrary-value');

    await waitFor(() => {
      const c = mockData.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(c).toBeDefined();
      expect(JSON.parse(c?.init?.body as string)).toEqual({
        confirm_token: 'token-xyz',
      });
    });

    // The OAuth path is storage-independent: it never read or wrote storage.
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('still POSTs /confirm when sessionStorage is severed (writes dropped, reads null)', async () => {
    const { screen, mockData } = await renderAndWaitForAuthorize();

    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => undefined);
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(null);

    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });
    expect(openSpy).toHaveBeenCalledTimes(1);

    await dispatchComplete('arbitrary-value');

    await waitFor(() => {
      const c = mockData.calls.find((c) =>
        c.url.endsWith(`/${UNIFIED_API}/${SERVICE_ID}/confirm`)
      );
      expect(c).toBeDefined();
    });

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });
});

describe('Authorize button OAuth grant handoff flow', () => {
  let fakeChild: FakeChild;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
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

  const renderVaultAndWaitForAuthorize = async (
    options: OAuthMockOptions = {},
    vaultProps: Record<string, any> = {}
  ) => {
    const mockData = setupOAuthFetchMock(SERVICE_ID, {}, options);
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          token="token123"
          open
          unifiedApi={UNIFIED_API}
          serviceId={SERVICE_ID}
          {...(vaultProps as any)}
        />
      );
    });
    if (jest.isMockFunction(setTimeout)) {
      await act(async () => {
        jest.advanceTimersByTime(0);
      });
    }
    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });
    return { screen, mockData };
  };

  const clickAuthorize = async (screen: any) => {
    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });
  };

  const detailFetchCount = (calls: { url: string; init?: any }[]) =>
    calls.filter((c) => c.url === DETAIL_URL && c.init?.method === undefined)
      .length;

  it('opens the popup to the launch URL synchronously on click, before the grant mint resolves', async () => {
    const { screen, mockData } = await renderVaultAndWaitForAuthorize({
      grant: 'pending',
    });

    await clickAuthorize(screen);

    // The popup must open synchronously on the launch URL — the grant mock is
    // still unresolved here (it only resolves via releaseGrant).
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(LAUNCH_URL, '_blank', WINDOW_FEATURES);

    const grantCall = mockData.calls.find((c) => c.url.endsWith('/grant'));
    expect(grantCall).toBeDefined();
    expect(mockData.releaseGrant).toBeDefined();
  });

  it('still mints the grant with a POST to .../grant carrying the JWT headers', async () => {
    const { screen, mockData } = await renderVaultAndWaitForAuthorize();

    await clickAuthorize(screen);

    await waitFor(() => {
      const grantCall = mockData.calls.find(
        (c) => c.url === `${DETAIL_URL}/grant`
      );
      expect(grantCall).toBeDefined();
      expect(grantCall?.init?.method).toBe('POST');

      // The mint must carry the same JWT headers as every other Vault API
      // call in this harness (e.g. the SWR connection fetches).
      const authenticatedCall = mockData.calls.find(
        (c) => c.url === DETAIL_URL && c.init?.headers?.Authorization
      );
      expect(authenticatedCall).toBeDefined();
      expect(grantCall?.init?.headers).toMatchObject({
        Authorization: authenticatedCall?.init?.headers?.Authorization,
        'X-APIDECK-AUTH-TYPE': 'JWT',
      });
    });
  });

  it('on oauth_launch_ready from the child at the launch origin: posts oauth_launch_start with grant + legacy authorize URL (containing &nonce=) and explicit targetOrigin', async () => {
    const { screen } = await renderVaultAndWaitForAuthorize();

    await clickAuthorize(screen);
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
    expect(message.authorizeUrl).toContain(AUTHORIZE_URL_PREFIX);
    expect(message.authorizeUrl).toContain(`redirect_uri=${REDIRECT_URL}`);
    expect(message.authorizeUrl).toContain('nonce=');
    expect(
      new URL(message.authorizeUrl).searchParams.get('nonce')
    ).toBeTruthy();
    // The child was never navigated: the grant travels via postMessage only.
    expect(fakeChild.location.href).toBe('');
  });

  it('when the grant mint returns non-2xx: navigates the popup to the legacy authorize URL and the legacy oauth_complete → /confirm path still works end-to-end', async () => {
    const { screen, mockData } = await renderVaultAndWaitForAuthorize({
      grant: 'failure',
    });

    await clickAuthorize(screen);
    await dispatchLaunchReady(fakeChild);

    await waitFor(() => {
      expect(fakeChild.location.href).not.toBe('');
    });
    const legacyUrl = fakeChild.location.href;
    expect(legacyUrl).toContain(AUTHORIZE_URL_PREFIX);
    const nonce = new URL(legacyUrl).searchParams.get('nonce') as string;
    expect(nonce).toBeTruthy();
    expect(fakeChild.postMessage).not.toHaveBeenCalled();

    await dispatchComplete(nonce);

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

  it('when no oauth_launch_ready arrives within LAUNCH_READY_TIMEOUT_MS: navigates the popup to the legacy authorize URL', async () => {
    jest.useFakeTimers();
    const { screen } = await renderVaultAndWaitForAuthorize();

    await clickAuthorize(screen);

    await act(async () => {
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
    });

    expect(fakeChild.location.href).toContain(AUTHORIZE_URL_PREFIX);
    expect(
      new URL(fakeChild.location.href).searchParams.get('nonce')
    ).toBeTruthy();
    expect(fakeChild.postMessage).not.toHaveBeenCalled();
  });

  it('legacy oauth_complete received after a completed handoff handshake: still POSTs /confirm exactly once (popup-side fallback; no double confirm with the poller)', async () => {
    jest.useFakeTimers();
    const { screen, mockData } = await renderVaultAndWaitForAuthorize();

    await clickAuthorize(screen);
    const authorizeUrl = await completeHandshake(fakeChild);
    const nonce = new URL(authorizeUrl).searchParams.get('nonce') as string;

    await dispatchComplete(nonce);

    await waitFor(() => {
      expect(
        mockData.calls.filter((c) => c.url.endsWith('/confirm')).length
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

    expect(
      mockData.calls.filter((c) => c.url.endsWith('/confirm')).length
    ).toBe(1);
    expect(screen.queryByText(/not completed/i)).not.toBeInTheDocument();
  });

  it('on popup close after handoff without oauth_complete: polls the connection detail URL and, on state=callable, mutates and fires onConnectionChange without an error toast', async () => {
    jest.useFakeTimers();
    const onConnectionChange = jest.fn();
    const { screen, mockData } = await renderVaultAndWaitForAuthorize(
      { detailState: 'pending_confirmation' },
      { onConnectionChange }
    );

    await clickAuthorize(screen);
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

    const fetchesBeforePoll = detailFetchCount(mockData.calls);
    await act(async () => {
      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
    });
    expect(detailFetchCount(mockData.calls)).toBeGreaterThan(fetchesBeforePoll);

    mockData.detailState = 'callable';
    await act(async () => {
      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'callable' })
      );
    });
    expect(screen.queryByText(/not completed/i)).not.toBeInTheDocument();
  });

  it('on popup close with the connection stuck pending_confirmation: shows an actionable error toast after the poll budget, never a silent success', async () => {
    jest.useFakeTimers();
    const onConnectionChange = jest.fn();
    const { screen, mockData } = await renderVaultAndWaitForAuthorize(
      { detailState: 'pending_confirmation' },
      { onConnectionChange }
    );

    await clickAuthorize(screen);
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
    expect(screen.getByText(/not completed/i)).toBeInTheDocument();
    expect(onConnectionChange).not.toHaveBeenCalled();
    expect(
      mockData.calls.find((c) => c.url.endsWith('/confirm'))
    ).toBeUndefined();
  });

  it('on oauth_error: toasts, does not confirm, and does not start the callable poll', async () => {
    jest.useFakeTimers();
    const { screen, mockData } = await renderVaultAndWaitForAuthorize();

    await clickAuthorize(screen);

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
      expect(screen.queryByText('User denied consent')).toBeInTheDocument();
    });

    const fetchesAfterError = detailFetchCount(mockData.calls);

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
    expect(detailFetchCount(mockData.calls)).toBe(fetchesAfterError);
    expect(
      mockData.calls.find((c) => c.url.endsWith('/confirm'))
    ).toBeUndefined();
  });
});
