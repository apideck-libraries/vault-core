// How long to wait for the popup's `oauth_launch_ready` message before
// falling back to the legacy flow — covers vault deployments that don't
// serve the launch page yet.
export const LAUNCH_READY_TIMEOUT_MS = 3000;

// How often to poll the connection state for `callable` after the popup
// closes.
export const CALLABLE_POLL_INTERVAL_MS = 1000;

// Total time budget for the `callable` poll before giving up and reporting
// a timeout.
export const CALLABLE_POLL_BUDGET_MS = 15000;

// How often to check whether the OAuth popup has been closed.
export const POPUP_CLOSE_CHECK_INTERVAL_MS = 500;

// Grace period after the popup closes before treating the flow as abandoned —
// gives an in-flight `oauth_complete` / `oauth_error` message time to arrive
// and settle the flow first.
export const POPUP_CLOSE_GRACE_MS = 1000;

// Standard window features for the OAuth popups (authorize and revoke).
export const OAUTH_POPUP_FEATURES =
  'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0';
