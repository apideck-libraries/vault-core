import 'whatwg-fetch';

import {
  callConfirmEndpoint,
  clearNonce,
  generateAndStoreNonce,
  verifyAndClearNonce,
} from '../src/utils/oauthCsrf';

const STORAGE_PREFIX = 'apideck_oauth_nonce_';

describe('oauthCsrf utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateAndStoreNonce', () => {
    it('returns a non-empty string and stores it under the prefixed key', () => {
      const nonce = generateAndStoreNonce('shopify');

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      expect(sessionStorage.getItem(`${STORAGE_PREFIX}shopify`)).toBe(nonce);
    });

    it('overwrites a previous nonce for the same serviceId', () => {
      const first = generateAndStoreNonce('shopify');
      const second = generateAndStoreNonce('shopify');

      expect(second).not.toBe(first);
      expect(sessionStorage.getItem(`${STORAGE_PREFIX}shopify`)).toBe(second);
    });
  });

  describe('verifyAndClearNonce', () => {
    it('returns true when the stored nonce matches and clears storage', () => {
      const nonce = generateAndStoreNonce('shopify');

      const result = verifyAndClearNonce('shopify', nonce);

      expect(result).toBe(true);
      expect(sessionStorage.getItem(`${STORAGE_PREFIX}shopify`)).toBeNull();
    });

    it('returns false when the stored nonce does not match and STILL clears storage', () => {
      generateAndStoreNonce('shopify');

      const result = verifyAndClearNonce('shopify', 'attacker-nonce');

      expect(result).toBe(false);
      expect(sessionStorage.getItem(`${STORAGE_PREFIX}shopify`)).toBeNull();
    });

    it('returns false when no nonce is stored for that serviceId', () => {
      const result = verifyAndClearNonce('shopify', 'anything');

      expect(result).toBe(false);
    });
  });

  describe('clearNonce', () => {
    it('removes the stored nonce', () => {
      generateAndStoreNonce('shopify');

      clearNonce('shopify');

      expect(sessionStorage.getItem(`${STORAGE_PREFIX}shopify`)).toBeNull();
    });

    it('is a no-op when nothing is stored', () => {
      expect(() => clearNonce('shopify')).not.toThrow();
    });
  });

  describe('callConfirmEndpoint', () => {
    const baseParams = {
      unifiedApi: 'ecommerce',
      serviceId: 'shopify',
      confirmToken: 'tok-abc',
      connectionsUrl: 'https://unify.apideck.com/vault/connections',
      headers: {
        Authorization: 'Bearer test-token',
        'X-APIDECK-APP-ID': 'app-id',
        'X-APIDECK-CONSUMER-ID': 'consumer-id',
      },
    };

    it('POSTs to {connectionsUrl}/{unifiedApi}/{serviceId}/confirm with confirm_token body and forwarded headers', async () => {
      const successResponse = {
        status_code: 200,
        status: 'OK',
        data: { confirmed: true },
      };
      const fetchSpy = jest.spyOn(window, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => successResponse,
      } as any);

      const result = await callConfirmEndpoint(baseParams);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'https://unify.apideck.com/vault/connections/ecommerce/shopify/confirm'
      );
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        'X-APIDECK-APP-ID': 'app-id',
        'X-APIDECK-CONSUMER-ID': 'consumer-id',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        confirm_token: 'tok-abc',
      });
      expect(result).toEqual(successResponse);
    });

    it('throws on non-2xx response', async () => {
      jest.spyOn(window, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid confirm token' }),
      } as any);

      await expect(callConfirmEndpoint(baseParams)).rejects.toThrow();
    });
  });
});
