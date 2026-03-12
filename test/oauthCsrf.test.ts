import 'whatwg-fetch';

import {
  generateAndStoreNonce,
  verifyAndClearNonce,
  clearNonce,
} from '../src/utils/oauthCsrf';

// jsdom 16 does not implement crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-1234'),
  },
});

const cryptoAny = globalThis.crypto as any;

beforeEach(() => {
  sessionStorage.clear();
  (cryptoAny.randomUUID as jest.Mock).mockClear();
});

describe('generateAndStoreNonce', () => {
  it('returns a string', () => {
    const nonce = generateAndStoreNonce('test-service');
    expect(typeof nonce).toBe('string');
  });

  it('stores the nonce in sessionStorage with the correct key', () => {
    const nonce = generateAndStoreNonce('test-service');
    expect(sessionStorage.getItem('vault_oauth_nonce_test-service')).toBe(
      nonce
    );
  });

  it('calling twice with same serviceId overwrites previous nonce', () => {
    (cryptoAny.randomUUID as jest.Mock)
      .mockReturnValueOnce('first-uuid')
      .mockReturnValueOnce('second-uuid');

    generateAndStoreNonce('test-service');
    const secondNonce = generateAndStoreNonce('test-service');

    expect(sessionStorage.getItem('vault_oauth_nonce_test-service')).toBe(
      'second-uuid'
    );
    expect(secondNonce).toBe('second-uuid');
  });
});

describe('verifyAndClearNonce', () => {
  it('returns true when receivedNonce matches stored nonce', () => {
    generateAndStoreNonce('test-service');
    const result = verifyAndClearNonce('test-service', 'test-uuid-1234');
    expect(result).toBe(true);
  });

  it('returns false when receivedNonce does not match', () => {
    generateAndStoreNonce('test-service');
    const result = verifyAndClearNonce('test-service', 'wrong-nonce');
    expect(result).toBe(false);
  });

  it('returns false when no nonce is stored for serviceId', () => {
    const result = verifyAndClearNonce('test-service', 'some-nonce');
    expect(result).toBe(false);
  });

  it('clears the nonce from sessionStorage after successful verification', () => {
    generateAndStoreNonce('test-service');
    verifyAndClearNonce('test-service', 'test-uuid-1234');
    expect(sessionStorage.getItem('vault_oauth_nonce_test-service')).toBeNull();
  });

  it('does NOT clear the nonce after failed verification', () => {
    generateAndStoreNonce('test-service');
    verifyAndClearNonce('test-service', 'wrong-nonce');
    expect(sessionStorage.getItem('vault_oauth_nonce_test-service')).toBe(
      'test-uuid-1234'
    );
  });
});

describe('clearNonce', () => {
  it('removes the nonce from sessionStorage', () => {
    generateAndStoreNonce('test-service');
    clearNonce('test-service');
    expect(sessionStorage.getItem('vault_oauth_nonce_test-service')).toBeNull();
  });

  it('no-ops if no nonce stored', () => {
    expect(() => clearNonce('test-service')).not.toThrow();
  });
});
