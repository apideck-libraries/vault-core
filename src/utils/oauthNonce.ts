const fallbackStore = new Map<string, string>()

const toHex = (b: number): string => b.toString(16).padStart(2, '0')

export const generateNonce = (): string => {
  const c = typeof crypto !== 'undefined' ? (crypto as any) : undefined
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  // Fallback for older browsers that support getRandomValues but not randomUUID
  const bytes = new Uint8Array(16)
  ;(c || crypto).getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const h = Array.from(bytes, toHex)
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}

const storageKey = (serviceId: string): string =>
  `apideck_oauth_nonce_${serviceId}`

export const storeNonce = (serviceId: string, nonce: string): void => {
  const key = storageKey(serviceId)
  try {
    sessionStorage.setItem(key, nonce)
  } catch {
    fallbackStore.set(key, nonce)
  }
}

export const retrieveAndClearNonce = (serviceId: string): string | null => {
  const key = storageKey(serviceId)
  try {
    const value = sessionStorage.getItem(key)
    if (value !== null) {
      sessionStorage.removeItem(key)
      return value
    }
  } catch {
    // sessionStorage inaccessible — try fallback
  }
  const fallbackValue = fallbackStore.get(key) ?? null
  if (fallbackValue !== null) {
    fallbackStore.delete(key)
  }
  return fallbackValue
}
