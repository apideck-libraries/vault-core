/**
 * OAuth grant-handoff utilities — the widget side of the vault `oauth/launch`
 * contract.
 *
 * Background and design rationale:
 * - thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md
 * - thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md
 *
 * Invariants:
 * - The grant is NEVER carried in a URL (no query params, no fragments).
 * - The opener → popup postMessage handshake (with an explicit, pinned
 *   `targetOrigin`) is the ONLY delivery channel for the grant.
 * - The legacy `oauth_complete` path remains intact as the fallback: any
 *   failure to mint a grant or to complete the handshake degrades to
 *   navigating the popup to the legacy authorize URL, never to a broken click.
 */
import {
  CALLABLE_POLL_BUDGET_MS,
  CALLABLE_POLL_INTERVAL_MS,
  LAUNCH_READY_TIMEOUT_MS,
} from '../constants/oauthGrantHandoff';
import { OAUTH_LAUNCH_PATH, REDIRECT_URL } from '../constants/urls';
import {
  GrantResponse,
  HandshakeOutcome,
  LaunchReadyMessage,
  LaunchStartMessage,
  PollOutcome,
} from '../types/OAuthGrantHandoff';

/**
 * Mint a single-use grant for the given connection. Returns the grant string
 * on success and `null` on any failure (non-2xx, network error, malformed
 * body). Never throws — a failed mint is the signal to fall back to the
 * legacy flow, not to break the click.
 */
export async function mintGrant(params: {
  unifiedApi: string;
  serviceId: string;
  connectionsUrl: string;
  headers: Record<string, string>;
}): Promise<string | null> {
  const url = `${params.connectionsUrl}/${params.unifiedApi}/${params.serviceId}/grant`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...params.headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as GrantResponse;
    return body?.data?.grant ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive the popup launch URL and its origin from the session's
 * `redirect_uri` (falling back to the default REDIRECT_URL). The launch URL
 * carries only a non-secret `service_id` for correlation — never a grant.
 * The returned `launchOrigin` is the pin used to validate the handshake.
 */
export function deriveLaunchUrl(
  session: { redirect_uri?: string } | null | undefined,
  serviceId: string
): { launchUrl: string; launchOrigin: string } {
  const launchOrigin = new URL(session?.redirect_uri ?? REDIRECT_URL).origin;
  const launchUrl = `${launchOrigin}${OAUTH_LAUNCH_PATH}?service_id=${encodeURIComponent(
    serviceId
  )}`;
  return { launchUrl, launchOrigin };
}

/**
 * Run the opener-side launch handshake against an already-opened popup
 * (opening the window stays synchronous at the call site).
 *
 * - On a valid `oauth_launch_ready` (same window as `child`, origin equal to
 *   `launchOrigin`) the minted grant is awaited and posted to the popup as an
 *   `oauth_launch_start` message with the pinned targetOrigin → 'handoff'.
 * - If the grant is null, or no valid ready arrives within
 *   LAUNCH_READY_TIMEOUT_MS, the popup is navigated to the legacy authorize
 *   URL instead → 'legacy'.
 *
 * Resolves exactly once; the message listener and timer are always cleaned
 * up on resolution.
 */
export function runLaunchHandshake(params: {
  child: Window;
  launchOrigin: string;
  legacyAuthorizeUrl: string;
  grantPromise: Promise<string | null>;
}): Promise<HandshakeOutcome> {
  const { child, launchOrigin, legacyAuthorizeUrl, grantPromise } = params;

  return new Promise<HandshakeOutcome>((resolve) => {
    let settled = false;
    let readyHandled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (outcome: HandshakeOutcome) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(outcome);
    };

    const fallBackToLegacy = () => {
      if (settled) return;
      child.location.href = legacyAuthorizeUrl;
      settle('legacy');
    };

    const onMessage = (event: MessageEvent) => {
      if (settled || readyHandled) return;
      const data = event.data as Partial<LaunchReadyMessage> | undefined;
      if (data?.type !== 'oauth_launch_ready') return;
      if (event.source !== child) return;
      if (event.origin !== launchOrigin) return;

      readyHandled = true;
      grantPromise.then(
        (grant) => {
          if (settled) return;
          if (grant) {
            const message: LaunchStartMessage = {
              type: 'oauth_launch_start',
              grant,
              authorizeUrl: legacyAuthorizeUrl,
            };
            child.postMessage(message, launchOrigin);
            settle('handoff');
          } else {
            fallBackToLegacy();
          }
        },
        () => fallBackToLegacy()
      );
    };

    window.addEventListener('message', onMessage);
    timer = setTimeout(fallBackToLegacy, LAUNCH_READY_TIMEOUT_MS);
  });
}

/**
 * Poll the connection detail endpoint until its state becomes `callable`,
 * the poll budget elapses ('timeout'), or `cancel()` is invoked (the promise
 * then simply never settles). Transient fetch/JSON errors are swallowed and
 * polling continues.
 */
export function pollForCallable(params: {
  detailUrl: string;
  headers: Record<string, string>;
}): { promise: Promise<PollOutcome>; cancel: () => void } {
  let interval: ReturnType<typeof setInterval> | undefined;
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const stopTimers = () => {
    if (interval !== undefined) clearInterval(interval);
    if (budgetTimer !== undefined) clearTimeout(budgetTimer);
  };

  const promise = new Promise<PollOutcome>((resolve) => {
    const settle = (outcome: PollOutcome) => {
      if (settled) return;
      settled = true;
      stopTimers();
      resolve(outcome);
    };

    interval = setInterval(async () => {
      try {
        const response = await fetch(params.detailUrl, {
          headers: params.headers,
        });
        const body = await response.json();
        if (settled) return;
        if (body?.data?.state === 'callable') settle('callable');
      } catch {
        // Transient error — keep polling until budget or cancel.
      }
    }, CALLABLE_POLL_INTERVAL_MS);

    budgetTimer = setTimeout(() => settle('timeout'), CALLABLE_POLL_BUDGET_MS);
  });

  const cancel = () => {
    settled = true;
    stopTimers();
  };

  return { promise, cancel };
}
