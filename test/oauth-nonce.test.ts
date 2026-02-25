import crypto from 'crypto'
import { generateNonce, storeNonce, retrieveAndClearNonce } from '../src/utils/oauthNonce'

// jsdom doesn't provide crypto — polyfill with Node's crypto
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: (arr: Uint8Array) => crypto.randomFillSync(arr),
      randomUUID: () => crypto.randomUUID(),
    },
    writable: true,
    configurable: true,
  })
})

describe('oauthNonce', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('generateNonce', () => {
    it('produces a string that looks like a UUID', () => {
      const nonce = generateNonce()
      expect(nonce).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    })

    it('produces unique values on successive calls', () => {
      const a = generateNonce()
      const b = generateNonce()
      expect(a).not.toBe(b)
    })

    it('uses getRandomValues fallback when randomUUID is unavailable', () => {
      const c = globalThis.crypto as any
      const original = c.randomUUID
      try {
        c.randomUUID = undefined
        const nonce = generateNonce()
        expect(nonce).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        )
      } finally {
        c.randomUUID = original
      }
    })
  })

  describe('storeNonce / retrieveAndClearNonce', () => {
    it('stores and retrieves a nonce for a service', () => {
      storeNonce('salesforce', 'nonce-123')
      expect(retrieveAndClearNonce('salesforce')).toBe('nonce-123')
    })

    it('clears nonce after retrieval (one-time use)', () => {
      storeNonce('salesforce', 'nonce-123')
      retrieveAndClearNonce('salesforce')
      expect(retrieveAndClearNonce('salesforce')).toBeNull()
    })

    it('returns null when no nonce is stored', () => {
      expect(retrieveAndClearNonce('unknown-service')).toBeNull()
    })

    it('isolates nonces per service', () => {
      storeNonce('salesforce', 'nonce-sf')
      storeNonce('hubspot', 'nonce-hs')
      expect(retrieveAndClearNonce('salesforce')).toBe('nonce-sf')
      expect(retrieveAndClearNonce('hubspot')).toBe('nonce-hs')
    })

    it('falls back to in-memory store when sessionStorage throws', () => {
      const original = sessionStorage.setItem
      sessionStorage.setItem = () => {
        throw new DOMException('Access denied')
      }
      sessionStorage.getItem = () => null
      sessionStorage.removeItem = () => undefined

      try {
        storeNonce('salesforce', 'nonce-fallback')
        expect(retrieveAndClearNonce('salesforce')).toBe('nonce-fallback')
        // Second retrieval returns null (one-time use)
        expect(retrieveAndClearNonce('salesforce')).toBeNull()
      } finally {
        sessionStorage.setItem = original
      }
    })
  })
})
