/**
 * Wire contract for the OAuth grant handoff flow — the vault-core side of the
 * vault `oauth/launch` contract. The grant is single-use, session-bound, and
 * never carried in a URL; it is handed to the popup exclusively via
 * postMessage with an explicit targetOrigin.
 */

// Popup → widget: the launch page has loaded and is ready to receive the grant.
export interface LaunchReadyMessage {
  type: 'oauth_launch_ready';
}

// Widget → popup: hand over the grant and the authorize URL to continue with.
// Must be posted with an explicit `targetOrigin`, never `'*'`.
export interface LaunchStartMessage {
  type: 'oauth_launch_start';
  grant: string;
  authorizeUrl: string;
}

export interface GrantResponse {
  status_code: number;
  status: string;
  data: {
    grant: string;
    expires_in: number;
  };
}

// Result of the launch handshake: the popup answered with `oauth_launch_ready`
// (handoff) or the timeout elapsed and we fall back to the legacy flow.
export type HandshakeOutcome = 'handoff' | 'legacy';

// Result of polling for connection state `callable` after the popup closes.
export type PollOutcome = 'callable' | 'timeout';
