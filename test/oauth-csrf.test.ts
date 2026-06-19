import 'whatwg-fetch';

import { callConfirmEndpoint, generateNonce } from '../src/utils/oauthCsrf';

describe('oauthCsrf utilities', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateNonce', () => {
    it('returns a non-empty string', () => {
      const nonce = generateNonce();

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('returns a different value on each call', () => {
      const first = generateNonce();
      const second = generateNonce();

      expect(second).not.toBe(first);
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
