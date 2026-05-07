import { ConfirmResponse } from '../types/OAuthCsrf';

const STORAGE_PREFIX = 'apideck_oauth_nonce_';

const storageKey = (serviceId: string) => `${STORAGE_PREFIX}${serviceId}`;

const generateUuid = (): string => {
  const c: any = (typeof window !== 'undefined' ? window.crypto : undefined) ||
    (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined);
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for environments without crypto.randomUUID — sufficient for nonce uniqueness.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export function generateAndStoreNonce(serviceId: string): string {
  const nonce = generateUuid();
  sessionStorage.setItem(storageKey(serviceId), nonce);
  return nonce;
}

export function verifyAndClearNonce(serviceId: string, nonce: string): boolean {
  const key = storageKey(serviceId);
  const stored = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (stored === null) return false;
  return stored === nonce;
}

export function clearNonce(serviceId: string): void {
  sessionStorage.removeItem(storageKey(serviceId));
}

export async function callConfirmEndpoint(params: {
  unifiedApi: string;
  serviceId: string;
  confirmToken: string;
  connectionsUrl: string;
  headers: Record<string, string>;
}): Promise<ConfirmResponse> {
  const url = `${params.connectionsUrl}/${params.unifiedApi}/${params.serviceId}/confirm`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...params.headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm_token: params.confirmToken }),
  });

  if (!response.ok) {
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ConfirmResponse;
}
