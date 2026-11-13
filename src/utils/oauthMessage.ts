// Filter for the `oauth_complete` / `oauth_error` messages the OAuth callback
// page posts to the window that opened the popup (GH-9546).
//
// Both checks are needed:
// - `event.source === popup` stops any other window on the callback origin
//   (another tab, a frame) from completing or failing this flow.
// - `event.origin === acceptedOrigin` stops a page the popup has navigated to
//   (the provider, or an attacker-controlled redirect) from speaking for the
//   callback page.
//
// The accepted origin is the origin of the `redirect_uri` the flow actually
// sent (`messageOriginForPopupUrl` on the URL passed to `window.open`), so it
// follows white-label callback pages and can never drift from where unify
// redirects. `null` (no usable `redirect_uri`) and the opaque `'null'` accept
// nothing. A `null` popup (blocked) matches nothing, including a message
// without `source`. Callers return without cleaning up on a rejected message,
// so the popup-close refresh still ends the flow.
export function isMessageFromPopup(
  event: MessageEvent,
  popup: Window | null,
  acceptedOrigin: string | null
): boolean {
  if (popup === null) return false;
  if (event.source !== popup) return false;
  if (acceptedOrigin === null || acceptedOrigin === 'null') return false;
  return event.origin === acceptedOrigin;
}
