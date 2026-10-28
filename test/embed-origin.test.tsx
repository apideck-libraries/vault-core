import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { SWRConfig } from 'swr';

import { Vault } from '../src/components/Vault';
import { setupIntersectionObserverMock } from './mock';
import { CONFIG } from './responses/config';

const SERVICE_ID = 'shopify';
const UNIFIED_API = 'ecommerce';
const BASE_URL = 'https://unify.apideck.com';
const EMBED_ORIGIN = 'https://customer.example';

const setupFetchMock = (overrides: Record<string, any> = {}) => {
  const connection = {
    id: `${UNIFIED_API}+${SERVICE_ID}`,
    name: 'Shopify',
    tag_line: 'Test connector for embedOrigin tests',
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
    authorize_url: `${BASE_URL}/vault/authorize/${SERVICE_ID}/abc`,
    revoke_url: null,
    ...overrides,
  };
  const detailUrl = `${BASE_URL}/vault/connections/${UNIFIED_API}/${SERVICE_ID}`;

  (window.fetch as any).mockImplementation((url: string) => {
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
};

describe('embedOrigin prop', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(window, 'fetch');
    setupIntersectionObserverMock();
    const fakeChild = { closed: false, close: jest.fn() };
    openSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => fakeChild as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  // Each test gets its own SWR cache, so the `callable` connection of the
  // Re-authorize test does not leak into the Authorize tests.
  const vault = ({
    embedOrigin,
    showButtonLayout,
  }: {
    embedOrigin?: string;
    showButtonLayout?: boolean;
  }) => (
    <SWRConfig value={{ provider: () => new Map() }}>
      <Vault
        token="token123"
        open
        unifiedApi={UNIFIED_API}
        serviceId={SERVICE_ID}
        embedOrigin={embedOrigin}
        showButtonLayout={showButtonLayout}
      />
    </SWRConfig>
  );

  const renderVault = async (
    props: { embedOrigin?: string; showButtonLayout?: boolean } = {}
  ) => {
    let screen: any;
    await act(async () => {
      screen = render(vault(props));
    });
    return screen;
  };

  const clickAndReadUrl = async (screen: any, label: string) => {
    await waitFor(() => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText(label));
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
    return new URL(openSpy.mock.calls[0][0] as string);
  };

  it('sends the embedOrigin prop as embed_origin', async () => {
    setupFetchMock();
    const screen = await renderVault({ embedOrigin: EMBED_ORIGIN });

    const url = await clickAndReadUrl(screen, 'Authorize');
    expect(url.searchParams.getAll('embed_origin')).toEqual([EMBED_ORIGIN]);
  });

  it("sends embedOrigin 'null' verbatim", async () => {
    setupFetchMock();
    const screen = await renderVault({ embedOrigin: 'null' });

    const url = await clickAndReadUrl(screen, 'Authorize');
    expect(url.searchParams.getAll('embed_origin')).toEqual(['null']);
  });

  it('defaults embed_origin to window.location.origin without the prop', async () => {
    setupFetchMock();
    const screen = await renderVault();

    const url = await clickAndReadUrl(screen, 'Authorize');
    expect(url.searchParams.getAll('embed_origin')).toEqual([
      window.location.origin,
    ]);
  });

  it('sends window.location.origin as opener_origin when embedOrigin differs', async () => {
    setupFetchMock();
    const screen = await renderVault({ embedOrigin: EMBED_ORIGIN });

    const url = await clickAndReadUrl(screen, 'Authorize');
    expect(url.searchParams.getAll('opener_origin')).toEqual([
      window.location.origin,
    ]);
    expect(url.searchParams.getAll('embed_origin')).toEqual([EMBED_ORIGIN]);
  });

  it('uses the latest embedOrigin after the prop changes', async () => {
    setupFetchMock();
    const screen = await renderVault({ embedOrigin: EMBED_ORIGIN });
    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument();
    });

    const changedOrigin = 'https://other-customer.example';
    await act(async () => {
      screen.rerender(vault({ embedOrigin: changedOrigin }));
    });

    const url = await clickAndReadUrl(screen, 'Authorize');
    expect(url.searchParams.getAll('embed_origin')).toEqual([changedOrigin]);
  });

  it('Re-authorize carries the embedOrigin prop', async () => {
    setupFetchMock({ state: 'callable' });
    const screen = await renderVault({
      embedOrigin: EMBED_ORIGIN,
      showButtonLayout: true,
    });

    const url = await clickAndReadUrl(screen, 'Re-authorize');
    expect(url.searchParams.getAll('embed_origin')).toEqual([EMBED_ORIGIN]);
    expect(url.searchParams.getAll('opener_origin')).toEqual([
      window.location.origin,
    ]);
  });
});
