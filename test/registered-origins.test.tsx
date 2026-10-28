import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { SWRConfig } from 'swr';

import { Vault } from '../src/components/Vault';
import { REDIRECT_URL, STAGING_REDIRECT_URL } from '../src/constants/urls';
import {
  dispatchMessage,
  setupIntersectionObserverMock,
  tokenWithClaims,
} from './mock';
import { CONFIG } from './responses/config';

const SERVICE_ID = 'shopify';
const UNIFIED_API = 'ecommerce';
const PRODUCTION_BASE_URL = 'https://unify.apideck.com';
const STAGING_BASE_URL =
  'https://deploy-preview-staging--unify.stagingapideck.com';

const makeConnection = (
  baseUrl: string,
  overrides: Record<string, any> = {}
) => ({
  id: `${UNIFIED_API}+${SERVICE_ID}`,
  name: 'Shopify',
  tag_line: 'Test connector for registered origins tests',
  icon: 'https://example.com/icon.png',
  website: 'https://example.com',
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
  authorize_url: `${baseUrl}/vault/authorize/${SERVICE_ID}/abc`,
  revoke_url: null,
  ...overrides,
});

// Fetch mock for one unify base URL: the detail URL is
// `${baseUrl}/vault/connections/ecommerce/shopify`, and `/confirm` POSTs are
// recorded so a test can tell whether a message was acted on.
const setupFetchMock = (
  baseUrl: string,
  overrides: Record<string, any> = {}
) => {
  const connection = makeConnection(baseUrl, overrides);
  const detailUrl = `${baseUrl}/vault/connections/${UNIFIED_API}/${SERVICE_ID}`;
  const calls: { url: string; init?: any }[] = [];

  (window.fetch as any).mockImplementation((url: string, init?: any) => {
    calls.push({ url, init });
    if (url.endsWith('/confirm') && init?.method === 'POST') {
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
        json: async () => ({ status_code: 200, data: connection }),
      };
    }
    if (url.includes('/config')) {
      return { ok: true, status: 200, json: async () => CONFIG };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status_code: 200, data: [connection] }),
    };
  });

  const confirmCalls = () =>
    calls.filter(
      (c) =>
        c.url === `${detailUrl}/confirm` && (c.init?.method ?? '') === 'POST'
    );

  return { calls, confirmCalls };
};

const completeMessage = {
  type: 'oauth_complete',
  nonce: 'n',
  confirmToken: 'token-xyz',
  serviceId: SERVICE_ID,
  success: true,
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('registered origins', () => {
  let fakeChild: { closed: boolean; close: jest.Mock };
  let otherWindow: { closed: boolean; close: jest.Mock };
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
    fakeChild = { closed: false, close: jest.fn() };
    otherWindow = { closed: false, close: jest.fn() };
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  // Each render gets its own SWR cache, so connections that differ between
  // tests (state, revoke_url, base URL) never leak into one another.
  const renderVault = async (props: Record<string, unknown>) => {
    let screen: any;
    await act(async () => {
      screen = render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <Vault
            token={tokenWithClaims({})}
            open
            unifiedApi={UNIFIED_API}
            serviceId={SERVICE_ID}
            {...props}
          />
        </SWRConfig>
      );
    });
    return screen;
  };

  const clickAuthorize = async (screen: any) => {
    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Authorize'));
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
    return new URL(openSpy.mock.calls[0][0] as string);
  };

  const openTopBarMenu = async (screen: any) => {
    await waitFor(() => {
      expect(screen.getByTestId('dropdown')).toBeInTheDocument();
    });
    const menuButton = screen
      .getByTestId('dropdown')
      .querySelector('button') as HTMLElement;
    await act(async () => {
      fireEvent.click(menuButton);
    });
  };

  it('accepts messages from a custom callback page set as session redirect_uri and ignores the Apideck callback origin', async () => {
    const customCallback = 'https://connect.customer.example/oauth/callback';
    const { confirmCalls } = setupFetchMock(PRODUCTION_BASE_URL);
    const screen = await renderVault({
      token: tokenWithClaims({ redirect_uri: customCallback }),
    });

    const url = await clickAuthorize(screen);
    expect(url.searchParams.getAll('redirect_uri')).toEqual([customCallback]);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: fakeChild,
    });
    await flush();
    expect(confirmCalls()).toHaveLength(0);

    await dispatchMessage(completeMessage, {
      origin: 'https://connect.customer.example',
      source: fakeChild,
    });
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it('sends an invalid session redirect_uri verbatim and acts on no message', async () => {
    const { confirmCalls } = setupFetchMock(PRODUCTION_BASE_URL);
    const screen = await renderVault({
      token: tokenWithClaims({ redirect_uri: 'not a url' }),
    });

    const url = await clickAuthorize(screen);
    expect(url.searchParams.getAll('redirect_uri')).toEqual(['not a url']);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: fakeChild,
    });
    await dispatchMessage(completeMessage, {
      origin: window.location.origin,
      source: fakeChild,
    });
    await flush();
    expect(confirmCalls()).toHaveLength(0);
  });

  it('uses the staging callback page for a staging unifyBaseUrl and ignores the production callback origin', async () => {
    const { confirmCalls } = setupFetchMock(STAGING_BASE_URL);
    const screen = await renderVault({ unifyBaseUrl: STAGING_BASE_URL });

    const url = await clickAuthorize(screen);
    expect(url.origin).toBe(STAGING_BASE_URL);
    expect(url.searchParams.getAll('redirect_uri')).toEqual([
      STAGING_REDIRECT_URL,
    ]);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: fakeChild,
    });
    await flush();
    expect(confirmCalls()).toHaveLength(0);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.stagingapideck.com',
      source: fakeChild,
    });
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it("Re-authorize in the button layout sends both origins and acts only on its popup's messages", async () => {
    const { confirmCalls } = setupFetchMock(PRODUCTION_BASE_URL, {
      state: 'callable',
    });
    const screen = await renderVault({ showButtonLayout: true });

    await waitFor(() => {
      expect(screen.getByText('Re-authorize')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Re-authorize'));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.getAll('redirect_uri')).toEqual([REDIRECT_URL]);
    expect(url.searchParams.getAll('opener_origin')).toEqual([
      window.location.origin,
    ]);
    expect(url.searchParams.getAll('embed_origin')).toEqual([
      window.location.origin,
    ]);
    expect(url.searchParams.getAll('nonce')).toHaveLength(1);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: otherWindow,
    });
    await flush();
    expect(confirmCalls()).toHaveLength(0);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: fakeChild,
    });
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it("Re-authorize in the TopBar menu sends both origins and acts only on its popup's messages", async () => {
    const { confirmCalls } = setupFetchMock(PRODUCTION_BASE_URL, {
      state: 'callable',
    });
    const screen = await renderVault({});

    await openTopBarMenu(screen);
    await act(async () => {
      fireEvent.click(screen.getByText('Re-authorize'));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(url.searchParams.getAll('redirect_uri')).toEqual([REDIRECT_URL]);
    expect(url.searchParams.getAll('opener_origin')).toEqual([
      window.location.origin,
    ]);
    expect(url.searchParams.getAll('embed_origin')).toEqual([
      window.location.origin,
    ]);
    expect(url.searchParams.getAll('nonce')).toHaveLength(1);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: otherWindow,
    });
    await flush();
    expect(confirmCalls()).toHaveLength(0);

    await dispatchMessage(completeMessage, {
      origin: 'https://vault.apideck.com',
      source: fakeChild,
    });
    await waitFor(() => expect(confirmCalls()).toHaveLength(1));
  });

  it('Disconnect still opens the revoke URL unchanged', async () => {
    const revokeUrl = `${PRODUCTION_BASE_URL}/vault/revoke/${SERVICE_ID}/abc?state=s`;
    setupFetchMock(PRODUCTION_BASE_URL, {
      state: 'callable',
      revoke_url: revokeUrl,
    });
    const screen = await renderVault({});

    await openTopBarMenu(screen);
    await act(async () => {
      fireEvent.click(screen.getByText('Disconnect'));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toBe(
      `${revokeUrl}&redirect_uri=${REDIRECT_URL}`
    );
  });
});
