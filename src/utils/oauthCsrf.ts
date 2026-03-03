const STORAGE_KEY_PREFIX = 'vault_oauth_nonce_';

export function generateAndStoreNonce(serviceId: string): string {
  const nonce = (crypto as any).randomUUID() as string;
  sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${serviceId}`, nonce);
  return nonce;
}

export function verifyAndClearNonce(
  serviceId: string,
  receivedNonce: string
): boolean {
  const storedNonce = sessionStorage.getItem(
    `${STORAGE_KEY_PREFIX}${serviceId}`
  );
  if (!storedNonce || storedNonce !== receivedNonce) {
    return false;
  }
  sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${serviceId}`);
  return true;
}

export function clearNonce(serviceId: string): void {
  sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${serviceId}`);
}
