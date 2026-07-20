import '@testing-library/jest-dom/extend-expect';
import 'whatwg-fetch';

import {
  CALLABLE_POLL_BUDGET_MS,
  CALLABLE_POLL_INTERVAL_MS,
  LAUNCH_READY_TIMEOUT_MS,
} from '../src/constants/oauthGrantHandoff';
import { OAUTH_LAUNCH_PATH, REDIRECT_URL } from '../src/constants/urls';
import {
  deriveLaunchUrl,
  mintGrant,
  pollForCallable,
  runLaunchHandshake,
} from '../src/utils/oauthGrantHandoff';

// Flush pending microtasks (fetch/json chains) without relying on real
// timers — safe to use while jest fake timers are installed.
const flushPromises = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
};

describe('oauthGrantHandoff utilities', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('mintGrant', () => {
    const baseParams = {
      unifiedApi: 'crm',
      serviceId: 'salesforce',
      connectionsUrl: 'https://unify.apideck.com/vault/connections',
      headers: {
        Authorization: 'Bearer test-token',
        'X-APIDECK-APP-ID': 'app-id',
        'X-APIDECK-CONSUMER-ID': 'consumer-id',
      },
    };

    it('POSTs to {connectionsUrl}/{unifiedApi}/{serviceId}/grant with the provided headers and returns the grant string on 2xx', async () => {
      const grantResponse = {
        status_code: 200,
        status: 'OK',
        data: { grant: 'grant-token-123', expires_in: 60 },
      };
      const fetchSpy = jest.spyOn(window, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => grantResponse,
      } as any);

      const result = await mintGrant(baseParams);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'https://unify.apideck.com/vault/connections/crm/salesforce/grant'
      );
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        'X-APIDECK-APP-ID': 'app-id',
        'X-APIDECK-CONSUMER-ID': 'consumer-id',
        'Content-Type': 'application/json',
      });
      expect(result).toBe('grant-token-123');
    });

    it('returns null on non-2xx response (grant flow unavailable → caller falls back to legacy)', async () => {
      jest.spyOn(window, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Unknown endpoint' }),
      } as any);

      const result = await mintGrant(baseParams);

      expect(result).toBeNull();
    });

    it('returns null when fetch rejects (network error) instead of throwing', async () => {
      jest
        .spyOn(window, 'fetch')
        .mockRejectedValue(new TypeError('Network request failed'));

      await expect(mintGrant(baseParams)).resolves.toBeNull();
    });
  });

  describe('deriveLaunchUrl', () => {
    it('builds {origin(redirect_uri)}{OAUTH_LAUNCH_PATH}?service_id=... from a session redirect_uri', () => {
      const session = {
        redirect_uri: 'https://vault.eu.apideck.com/oauth/callback?foo=bar',
      };

      const { launchUrl, launchOrigin } = deriveLaunchUrl(
        session,
        'salesforce'
      );

      expect(launchOrigin).toBe('https://vault.eu.apideck.com');
      expect(launchUrl).toBe(
        `https://vault.eu.apideck.com${OAUTH_LAUNCH_PATH}?service_id=salesforce`
      );
    });

    it('falls back to the REDIRECT_URL origin when session has no redirect_uri', () => {
      const expectedOrigin = new URL(REDIRECT_URL).origin;

      const noSession = deriveLaunchUrl(undefined, 'salesforce');
      expect(noSession.launchOrigin).toBe(expectedOrigin);
      expect(noSession.launchUrl).toBe(
        `${expectedOrigin}${OAUTH_LAUNCH_PATH}?service_id=salesforce`
      );

      const emptySession = deriveLaunchUrl({}, 'salesforce');
      expect(emptySession.launchOrigin).toBe(expectedOrigin);
      expect(emptySession.launchUrl).toBe(
        `${expectedOrigin}${OAUTH_LAUNCH_PATH}?service_id=salesforce`
      );
    });

    it('never includes a grant parameter regardless of inputs', () => {
      const sessions = [
        undefined,
        null,
        {},
        { redirect_uri: 'https://vault.eu.apideck.com/oauth/callback' },
        {
          redirect_uri:
            'https://vault.apideck.com/oauth/callback?grant=leaky-grant',
        },
      ];

      sessions.forEach((session) => {
        const { launchUrl } = deriveLaunchUrl(session as any, 'salesforce');

        expect(new URL(launchUrl).searchParams.has('grant')).toBe(false);
        expect(launchUrl).not.toContain('grant');
      });
    });
  });

  describe('runLaunchHandshake', () => {
    const launchOrigin = 'https://vault.apideck.com';
    const legacyAuthorizeUrl =
      'https://example.com/oauth/authorize?state=xyz&client_id=abc';

    const makeChild = () => ({
      postMessage: jest.fn(),
      location: { href: '' },
    });

    const dispatchReady = (source: unknown, origin: string = launchOrigin) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth_launch_ready' },
          origin,
          source: source as any,
        })
      );
    };

    it("posts oauth_launch_start with the grant and legacy authorize URL to the child with explicit targetOrigin after a valid ready message, and resolves 'handoff'", async () => {
      jest.useFakeTimers();
      const child = makeChild();

      const promise = runLaunchHandshake({
        child: child as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });

      dispatchReady(child);

      await expect(promise).resolves.toBe('handoff');
      expect(child.postMessage).toHaveBeenCalledTimes(1);
      expect(child.postMessage).toHaveBeenCalledWith(
        {
          type: 'oauth_launch_start',
          grant: 'grant-token-123',
          authorizeUrl: legacyAuthorizeUrl,
        },
        launchOrigin
      );
      // The child must not have been navigated to the legacy URL.
      expect(child.location.href).toBe('');
    });

    it('ignores a ready message whose event.source is not the opened child', async () => {
      jest.useFakeTimers();
      const child = makeChild();
      const impostor = makeChild();

      const promise = runLaunchHandshake({
        child: child as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });

      dispatchReady(impostor);
      await flushPromises();

      expect(child.postMessage).not.toHaveBeenCalled();

      // Without a valid ready message the handshake falls back to legacy.
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
      await expect(promise).resolves.toBe('legacy');
      expect(child.postMessage).not.toHaveBeenCalled();
      expect(child.location.href).toBe(legacyAuthorizeUrl);
    });

    it('ignores a ready message whose event.origin differs from the launch origin', async () => {
      jest.useFakeTimers();
      const child = makeChild();

      const promise = runLaunchHandshake({
        child: child as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });

      dispatchReady(child, 'https://evil.example.com');
      await flushPromises();

      expect(child.postMessage).not.toHaveBeenCalled();

      // Without a valid ready message the handshake falls back to legacy.
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
      await expect(promise).resolves.toBe('legacy');
      expect(child.postMessage).not.toHaveBeenCalled();
      expect(child.location.href).toBe(legacyAuthorizeUrl);
    });

    it("navigates the child to the legacy authorize URL and resolves 'legacy' when no ready arrives within LAUNCH_READY_TIMEOUT_MS", async () => {
      jest.useFakeTimers();
      const child = makeChild();

      const promise = runLaunchHandshake({
        child: child as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });

      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS - 1);
      await flushPromises();
      expect(child.location.href).toBe('');

      jest.advanceTimersByTime(1);
      await expect(promise).resolves.toBe('legacy');
      expect(child.location.href).toBe(legacyAuthorizeUrl);
      expect(child.postMessage).not.toHaveBeenCalled();
    });

    it("navigates the child to the legacy authorize URL and resolves 'legacy' when the grant promise resolves null (mint failed)", async () => {
      jest.useFakeTimers();
      const child = makeChild();

      const promise = runLaunchHandshake({
        child: child as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve(null),
      });

      dispatchReady(child);

      await expect(promise).resolves.toBe('legacy');
      expect(child.location.href).toBe(legacyAuthorizeUrl);
      expect(child.postMessage).not.toHaveBeenCalled();
    });

    it('removes its message listener after resolving (both outcomes)', async () => {
      jest.useFakeTimers();
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const messageListenerRemovals = () =>
        removeEventListenerSpy.mock.calls.filter(([type]) => type === 'message')
          .length;

      // Handoff outcome
      const handoffChild = makeChild();
      const handoffPromise = runLaunchHandshake({
        child: handoffChild as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });
      dispatchReady(handoffChild);
      await expect(handoffPromise).resolves.toBe('handoff');
      expect(messageListenerRemovals()).toBeGreaterThanOrEqual(1);

      // A late ready message after resolution must do nothing.
      handoffChild.postMessage.mockClear();
      dispatchReady(handoffChild);
      await flushPromises();
      expect(handoffChild.postMessage).not.toHaveBeenCalled();

      // Legacy outcome
      const removalsAfterHandoff = messageListenerRemovals();
      const legacyChild = makeChild();
      const legacyPromise = runLaunchHandshake({
        child: legacyChild as unknown as Window,
        launchOrigin,
        legacyAuthorizeUrl,
        grantPromise: Promise.resolve('grant-token-123'),
      });
      jest.advanceTimersByTime(LAUNCH_READY_TIMEOUT_MS);
      await expect(legacyPromise).resolves.toBe('legacy');
      expect(messageListenerRemovals()).toBeGreaterThan(removalsAfterHandoff);

      // A late ready message after the legacy fallback must do nothing either.
      dispatchReady(legacyChild);
      await flushPromises();
      expect(legacyChild.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('pollForCallable', () => {
    const detailUrl =
      'https://unify.apideck.com/vault/connections/crm/salesforce';
    const headers = {
      Authorization: 'Bearer test-token',
      'X-APIDECK-APP-ID': 'app-id',
      'X-APIDECK-CONSUMER-ID': 'consumer-id',
    };

    const connectionResponse = (state: string) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          status_code: 200,
          status: 'OK',
          data: { state },
        }),
      } as any);

    it("resolves 'callable' as soon as a poll returns a connection with state 'callable'", async () => {
      jest.useFakeTimers();
      const states = ['pending_confirmation', 'pending_confirmation'];
      const calls: any[] = [];
      jest.spyOn(window, 'fetch').mockImplementation(((url: any, init: any) => {
        calls.push([url, init]);
        return Promise.resolve(
          connectionResponse(states.shift() ?? 'callable')
        );
      }) as any);

      const { promise, cancel } = pollForCallable({ detailUrl, headers });
      let outcome: string | undefined;
      promise.then((result) => {
        outcome = result;
      });

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      expect(outcome).toBeUndefined();

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      expect(outcome).toBeUndefined();

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      expect(outcome).toBe('callable');

      expect(calls.length).toBe(3);
      const [url, init] = calls[0];
      expect(url).toBe(detailUrl);
      expect(init).toMatchObject({ headers });

      cancel();
    });

    it("resolves 'timeout' when the poll budget elapses while state stays 'pending_confirmation'", async () => {
      jest.useFakeTimers();
      const fetchSpy = jest
        .spyOn(window, 'fetch')
        .mockImplementation((() =>
          Promise.resolve(connectionResponse('pending_confirmation'))) as any);

      const { promise } = pollForCallable({ detailUrl, headers });
      let outcome: string | undefined;
      promise.then((result) => {
        outcome = result;
      });

      const ticks = CALLABLE_POLL_BUDGET_MS / CALLABLE_POLL_INTERVAL_MS;
      for (let i = 0; i < ticks; i++) {
        jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
        await flushPromises();
      }

      expect(outcome).toBe('timeout');

      // Polling must have stopped once the budget elapsed.
      const callsAtTimeout = fetchSpy.mock.calls.length;
      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS * 3);
      await flushPromises();
      expect(fetchSpy.mock.calls.length).toBe(callsAtTimeout);
    });

    it('keeps polling through a failed fetch (transient error) rather than rejecting', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      jest.spyOn(window, 'fetch').mockImplementation((() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new TypeError('Network request failed'));
        }
        return Promise.resolve(connectionResponse('callable'));
      }) as any);

      const { promise } = pollForCallable({ detailUrl, headers });
      let outcome: string | undefined;
      let rejected = false;
      promise.then(
        (result) => {
          outcome = result;
        },
        () => {
          rejected = true;
        }
      );

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      expect(rejected).toBe(false);
      expect(outcome).toBeUndefined();

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      expect(rejected).toBe(false);
      expect(outcome).toBe('callable');
    });

    it('stops polling immediately when the returned cancel function is invoked', async () => {
      jest.useFakeTimers();
      const fetchSpy = jest
        .spyOn(window, 'fetch')
        .mockImplementation((() =>
          Promise.resolve(connectionResponse('pending_confirmation'))) as any);

      const { promise, cancel } = pollForCallable({ detailUrl, headers });
      promise.then(
        () => undefined,
        () => undefined
      );

      jest.advanceTimersByTime(CALLABLE_POLL_INTERVAL_MS);
      await flushPromises();
      const callsBeforeCancel = fetchSpy.mock.calls.length;
      expect(callsBeforeCancel).toBeGreaterThan(0);

      cancel();

      jest.advanceTimersByTime(CALLABLE_POLL_BUDGET_MS * 2);
      await flushPromises();
      expect(fetchSpy.mock.calls.length).toBe(callsBeforeCancel);
    });
  });
});
