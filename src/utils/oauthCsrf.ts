import { ConfirmResponse } from '../types/OAuthCsrf';

const generateUuid = (): string => {
  const c: any =
    (typeof window !== 'undefined' ? window.crypto : undefined) ||
    (typeof globalThis !== 'undefined'
      ? (globalThis as any).crypto
      : undefined);
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for environments without crypto.randomUUID — sufficient for nonce uniqueness.
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;
};

// The nonce is an opaque value appended to the authorize URL purely as unify's
// opt-in trigger for the confirm flow. unify echoes it back verbatim and never
// verifies it server-side (CallbackConnectionUseCase.ts:394/475/494). The real
// CSRF protection is the single-use, context-bound `confirm_token` enforced by
// ConfirmConnectionUseCase.ts:62-69 against the authenticated session. So the
// client only needs to generate a fresh value — no storage, no verification.
export function generateNonce(): string {
  return generateUuid();
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
