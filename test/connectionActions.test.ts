import 'whatwg-fetch';
import * as React from 'react';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react-dom/test-utils';

// --- Mutable mock state ---

const mockMutate = jest.fn().mockResolvedValue({ data: {} });
const mockAddToast = jest.fn();
const mockOnConnectionChange = jest.fn();

let mockSelectedConnection: any = {
  service_id: 'test-service',
  unified_api: 'ecommerce',
  name: 'Test Service',
  oauth_grant_type: 'authorization_code',
};

let mockSession: any = {};

// --- Module-level mocks ---

jest.mock('../src/utils/useConnections', () => ({
  useConnections: () => ({
    selectedConnection: mockSelectedConnection,
    updateConnection: jest.fn(),
    connectionsUrl: 'https://unify.apideck.com/vault/connections',
    headers: { Authorization: 'Bearer token123' },
  }),
}));

jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock('@apideck/components', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (s: string) => s }),
}));

jest.mock('../src/utils/useSession', () => ({
  useSession: () => ({ session: mockSession }),
}));

// jsdom 16 does not implement crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: jest.fn(() => 'test-nonce-uuid') },
});

// --- Hook test component ---

import { useConnectionActions } from '../src/utils/connectionActions';

let hookResult: any;
const TestComponent = () => {
  hookResult = useConnectionActions();
  return null;
};

// --- Helpers ---

const CONNECTIONS_URL = 'https://unify.apideck.com/vault/connections';
const AUTHORIZE_URL = `${CONNECTIONS_URL}/ecommerce/test-service/authorize`;
const CONFIRM_URL = `${CONNECTIONS_URL}/ecommerce/test-service/confirm`;
const TOKEN_URL = `${CONNECTIONS_URL}/ecommerce/test-service/token`;

const makeAuthorizeResponse = (authorizeUrl = 'https://oauth.example.com/auth') => ({
  ok: true,
  json: () =>
    Promise.resolve({
      status_code: 200,
      status: 'OK',
      data: { authorize_url: authorizeUrl },
    }),
});

const makeConfirmResponse = (confirmed = true) => ({
  ok: true,
  json: () =>
    Promise.resolve({
      status_code: 200,
      status: 'OK',
      data: { confirmed },
    }),
});

const makeErrorResponse = (message = 'Something went wrong') => ({
  ok: false,
  json: () =>
    Promise.resolve({
      error: true,
      message,
    }),
});

const makeTokenResponse = () => ({
  ok: true,
  json: () =>
    Promise.resolve({
      status_code: 200,
      status: 'OK',
      data: {},
    }),
});

const dispatchOAuthComplete = (
  nonce: string,
  confirmToken = 'confirm-token-123',
  serviceId = 'test-service',
  origin = 'https://vault.apideck.com'
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin,
      data: {
        type: 'oauth_complete',
        nonce,
        confirmToken,
        serviceId,
        success: true,
      },
    })
  );
};

// --- Tests ---

describe('handleAuthorize', () => {
  let fetchSpy: jest.SpyInstance;
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(window, 'fetch');
    openSpy = jest.spyOn(window, 'open').mockReturnValue({
      closed: false,
    } as any);

    sessionStorage.clear();
    mockMutate.mockClear().mockResolvedValue({ data: {} });
    mockAddToast.mockClear();
    mockOnConnectionChange.mockClear();
    ((globalThis.crypto as any).randomUUID as jest.Mock).mockClear();

    mockSelectedConnection = {
      service_id: 'test-service',
      unified_api: 'ecommerce',
      name: 'Test Service',
      oauth_grant_type: 'authorization_code',
    };
    mockSession = {};
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
    openSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('happy path - full CSRF flow', () => {
    it('calls POST /authorize with nonce in body and correct auth headers', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(fetchSpy).toHaveBeenCalledWith(AUTHORIZE_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nonce: 'test-nonce-uuid', redirect_uri: 'https://vault.apideck.com/oauth/callback' }),
      });
    });

    it('opens popup with the authorize_url from the response', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL)
          return Promise.resolve(
            makeAuthorizeResponse('https://oauth.example.com/auth?state=abc')
          );
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://oauth.example.com/auth?state=abc',
        '_blank',
        expect.any(String)
      );
    });

    it('calls POST /confirm with confirm_token after matching postMessage', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      await act(async () => {
        dispatchOAuthComplete('test-nonce-uuid');
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(fetchSpy).toHaveBeenCalledWith(CONFIRM_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm_token: 'confirm-token-123' }),
      });
    });

    it('calls SWR mutate to re-fetch connection data after confirm', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      await act(async () => {
        dispatchOAuthComplete('test-nonce-uuid');
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockMutate).toHaveBeenCalledWith(
        `${CONNECTIONS_URL}/ecommerce/test-service`
      );
    });
  });

  describe('fallback - popup closed without postMessage', () => {
    it('re-fetches via SWR mutate when popup closes without postMessage', async () => {
      jest.useFakeTimers();

      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const mockChild = { closed: false };
      openSpy.mockReturnValue(mockChild);

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      // Simulate popup closing
      mockChild.closed = true;

      // Advance 500ms for checkChild to detect popup closed
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Advance 1000ms for grace period to complete
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        `${CONNECTIONS_URL}/ecommerce/test-service`
      );

      jest.useRealTimers();
    });
  });

  describe('race condition - postMessage arrives after popup closes', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('still calls confirm endpoint when postMessage arrives during grace period', async () => {
      jest.useFakeTimers();

      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const mockChild = { closed: false };
      openSpy.mockReturnValue(mockChild);

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      // Simulate popup closing BEFORE postMessage arrives
      mockChild.closed = true;

      // checkChild fires and detects popup closed
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // postMessage arrives during grace period (before cleanup)
      await act(async () => {
        dispatchOAuthComplete('test-nonce-uuid');
        // Flush microtasks with fake timers by advancing by 0
        jest.advanceTimersByTime(0);
      });

      // Advance past grace period
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Confirm endpoint SHOULD have been called via messageHandler
      const confirmCalls = fetchSpy.mock.calls.filter(
        (call: any[]) => call[0] === CONFIRM_URL
      );
      expect(confirmCalls).toHaveLength(1);
    });
  });

  describe('security - wrong nonce in postMessage', () => {
    it('does NOT call confirm endpoint when nonce does not match', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      await act(async () => {
        dispatchOAuthComplete('wrong-nonce-value');
        await new Promise((r) => setTimeout(r, 0));
      });

      // Confirm endpoint should NOT have been called
      const confirmCalls = fetchSpy.mock.calls.filter(
        (call: any[]) => call[0] === CONFIRM_URL
      );
      expect(confirmCalls).toHaveLength(0);
    });

    it('shows error toast when nonce does not match', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      await act(async () => {
        dispatchOAuthComplete('wrong-nonce-value');
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  describe('error - authorize endpoint fails', () => {
    it('shows error toast and does not open popup', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL)
          return Promise.resolve(makeErrorResponse('Authorization failed'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  describe('error - confirm endpoint fails', () => {
    it('shows error toast but still re-fetches connection data', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL)
          return Promise.resolve(makeErrorResponse('Confirm failed'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      await act(async () => {
        dispatchOAuthComplete('test-nonce-uuid');
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe('client credentials / password grant types', () => {
    it('uses existing token flow for client_credentials', async () => {
      mockSelectedConnection = {
        ...mockSelectedConnection,
        oauth_grant_type: 'client_credentials',
      };

      fetchSpy.mockImplementation((url: string) => {
        if (url === TOKEN_URL) return Promise.resolve(makeTokenResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      // Should call token endpoint, not authorize
      expect(fetchSpy).toHaveBeenCalledWith(TOKEN_URL, expect.anything());
      const authorizeCalls = fetchSpy.mock.calls.filter(
        (call: any[]) => call[0] === AUTHORIZE_URL
      );
      expect(authorizeCalls).toHaveLength(0);
    });

    it('uses existing token flow for password grant type', async () => {
      mockSelectedConnection = {
        ...mockSelectedConnection,
        oauth_grant_type: 'password',
      };

      fetchSpy.mockImplementation((url: string) => {
        if (url === TOKEN_URL) return Promise.resolve(makeTokenResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(fetchSpy).toHaveBeenCalledWith(TOKEN_URL, expect.anything());
      const authorizeCalls = fetchSpy.mock.calls.filter(
        (call: any[]) => call[0] === AUTHORIZE_URL
      );
      expect(authorizeCalls).toHaveLength(0);
    });
  });

  describe('redirect_uri handling', () => {
    it('includes redirect_uri in authorize body when session has one', async () => {
      mockSession = { redirect_uri: 'https://custom.example.com/callback' };

      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(fetchSpy).toHaveBeenCalledWith(AUTHORIZE_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nonce: 'test-nonce-uuid',
          redirect_uri: 'https://custom.example.com/callback',
        }),
      });
    });

    it('sends default REDIRECT_URL as redirect_uri when session has none', async () => {
      mockSession = {};

      fetchSpy.mockImplementation((url: string) => {
        if (url === AUTHORIZE_URL) return Promise.resolve(makeAuthorizeResponse());
        if (url === CONFIRM_URL) return Promise.resolve(makeConfirmResponse());
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(React.createElement(TestComponent));
      });

      await act(async () => {
        hookResult.handleAuthorize(mockOnConnectionChange);
      });

      expect(fetchSpy).toHaveBeenCalledWith(AUTHORIZE_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nonce: 'test-nonce-uuid', redirect_uri: 'https://vault.apideck.com/oauth/callback' }),
      });
    });
  });

});
