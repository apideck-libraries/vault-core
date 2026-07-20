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
