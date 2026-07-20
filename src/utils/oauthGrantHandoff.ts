/**
 * OAuth grant-handoff utilities — the widget side of the vault `oauth/launch`
 * contract.
 *
 * Background and design rationale:
 * - thoughts/shared/research/2026-07-14-oauth-confirm-iframe-context.md
 * - thoughts/shared/research/2026-07-16-oauth-confirm-handoff-sequence-diagrams.md
 *
 * Fallback ladder for confirming the authorization (strongest first):
 * 1. sessionStorage self-confirm — vault's callback page finds the grant that
 *    its launch page stashed in sessionStorage and confirms the connection
 *    itself, without involving the opener.
 * 2. Legacy opener postMessage — the callback posts `oauth_complete` to the
 *    opener, which calls the confirm endpoint (the pre-handoff flow).
 * 3. Loud error — neither channel completed; after the popup closes the
 *    widget polls the connection state and surfaces an actionable error toast
 *    instead of silently reporting success.
 *
 * Deployment-order dependency (each layer degrades gracefully until the next
 * one is live): unify grant endpoints → vault launch page/callback →
 * vault-core release.
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
  OAUTH_POPUP_FEATURES,
  POPUP_CLOSE_CHECK_INTERVAL_MS,
  POPUP_CLOSE_GRACE_MS,
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

/**
 * Open the grant-handoff popup and kick off the flow: open the vault launch
 * page synchronously (popup blockers), mint the grant in parallel (never
 * awaited before open, never carried in a URL), and run the launch handshake
 * fire-and-forget — it removes its own listener and timer once it resolves
 * ('handoff', or 'legacy' fallback navigation).
 *
 * Returns the popup window (`null` when the popup was blocked) so the caller
 * can watch it for close.
 */
export function openGrantHandoffPopup(params: {
  session: { redirect_uri?: string } | null | undefined;
  unifiedApi: string;
  serviceId: string;
  connectionsUrl: string;
  headers: Record<string, string>;
  legacyAuthorizeUrl: string;
}): Window | null {
  const { launchUrl, launchOrigin } = deriveLaunchUrl(
    params.session,
    params.serviceId
  );
  const child = window.open(launchUrl, '_blank', OAUTH_POPUP_FEATURES);
  const grantPromise = mintGrant({
    unifiedApi: params.unifiedApi,
    serviceId: params.serviceId,
    connectionsUrl: params.connectionsUrl,
    headers: params.headers,
  });
  if (child) {
    runLaunchHandshake({
      child,
      launchOrigin,
      legacyAuthorizeUrl: params.legacyAuthorizeUrl,
      grantPromise,
    });
  }
  return child;
}

/**
 * Watch a popup for close. Once it closes, wait POPUP_CLOSE_GRACE_MS (gives
 * an in-flight `oauth_complete` / `oauth_error` message time to arrive and
 * settle the flow first), then invoke `onClosed` — unless `isCompleted()`
 * reports the flow already finished. `cancel()` stops the watcher without
 * invoking `onClosed`.
 */
export function watchPopupClose(params: {
  child: Window | null;
  isCompleted: () => boolean;
  onClosed: () => void;
}): { cancel: () => void } {
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined = setInterval(() => {
    if (!params.child?.closed) return;
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
    graceTimer = setTimeout(() => {
      if (params.isCompleted()) return;
      params.onClosed();
    }, POPUP_CLOSE_GRACE_MS);
  }, POPUP_CLOSE_CHECK_INTERVAL_MS);

  return {
    cancel: () => {
      if (interval !== undefined) clearInterval(interval);
      if (graceTimer !== undefined) clearTimeout(graceTimer);
    },
  };
}

/**
 * Watch a popup for close and, once the grace period elapses without the
 * flow completing, poll the connection detail endpoint for state `callable`
 * (the popup closed without a definitive `oauth_complete` / `oauth_error`
 * message, so poll instead of blindly reporting success). `onOutcome`
 * receives 'callable' or 'timeout'; `cancel()` stops the watcher and any
 * in-flight poll without invoking `onOutcome`.
 */
export function watchPopupCloseAndPoll(params: {
  child: Window | null;
  detailUrl: string;
  headers: Record<string, string>;
  isCompleted: () => boolean;
  onOutcome: (outcome: PollOutcome) => void;
}): { cancel: () => void } {
  let cancelPoll: (() => void) | undefined;

  const watcher = watchPopupClose({
    child: params.child,
    isCompleted: params.isCompleted,
    onClosed: () => {
      const { promise, cancel } = pollForCallable({
        detailUrl: params.detailUrl,
        headers: params.headers,
      });
      cancelPoll = cancel;
      promise.then((outcome) => {
        cancelPoll = undefined;
        params.onOutcome(outcome);
      });
    },
  });

  return {
    cancel: () => {
      watcher.cancel();
      cancelPoll?.();
      cancelPoll = undefined;
    },
  };
}
