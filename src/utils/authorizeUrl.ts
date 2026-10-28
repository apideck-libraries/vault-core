import {
  REDIRECT_URL,
  STAGING_HOST_SUFFIX,
  STAGING_REDIRECT_URL,
} from '../constants/urls';
import { generateNonce } from './oauthCsrf';

// Authorize URLs for the unify registered-origins protection (GH-9546).
//
// unify's authorize endpoint reads `state`, `redirect_uri`, `scope`, `nonce`,
// `opener_origin` and `embed_origin`. With OAuth protection enforced it rejects
// a `redirect_uri`, `opener_origin` or `embed_origin` the application has not
// registered; an empty value is skipped. Apideck origins always pass as
// `opener_origin` or `embed_origin`, but only the Hosted Vault landing pages
// (the callback page and the integration page) pass as `redirect_uri`. When the
// session sets no `redirect_uri`, the Apideck callback page of the environment
// is used: `vault.stagingapideck.com` for a `*.stagingapideck.com` unify base
// URL, `vault.apideck.com` otherwise (unify's own `VAULT_URL` rule).
//
// `embedOrigin` is sent verbatim whenever it is defined: a host such as
// iframe-vault runs on an Apideck origin, so defaulting there would turn the
// embed check off. An empty string becomes `'null'` (fail closed) because unify
// treats an empty `embed_origin` as absent. Only `undefined` falls back to
// the document origin.

export function fallbackRedirectUri(unifyBaseUrl?: string): string {
  if (!unifyBaseUrl) return REDIRECT_URL;
  try {
    const { hostname } = new URL(unifyBaseUrl);
    return hostname.endsWith(STAGING_HOST_SUFFIX)
      ? STAGING_REDIRECT_URL
      : REDIRECT_URL;
  } catch {
    return REDIRECT_URL;
  }
}

export function buildAuthorizeUrl(params: {
  authorizeUrl?: string | null;
  sessionRedirectUri?: string;
  unifyBaseUrl?: string;
  embedOrigin?: string;
}): string | null {
  const { authorizeUrl, sessionRedirectUri, unifyBaseUrl, embedOrigin } =
    params;
  if (!authorizeUrl) return null;

  let url: URL;
  try {
    url = new URL(authorizeUrl);
  } catch {
    return null;
  }

  url.searchParams.set(
    'redirect_uri',
    sessionRedirectUri ?? fallbackRedirectUri(unifyBaseUrl)
  );
  url.searchParams.set('nonce', generateNonce());
  // The document origin, which the callback's target_origin must match. In an
  // about:blank or srcdoc frame location.origin is 'null' while window.origin
  // is the inherited origin.
  const documentOrigin = window.origin ?? window.location.origin;
  url.searchParams.set('opener_origin', documentOrigin);
  url.searchParams.set(
    'embed_origin',
    embedOrigin === undefined ? documentOrigin : embedOrigin || 'null'
  );
  return url.href;
}

// The origin the OAuth callback page posts from: the origin of the single
// `redirect_uri` in the URL the popup was opened with. Missing, duplicated,
// unparseable or non-http(s) values (whose origin is the opaque 'null') give
// `null`, which accepts no message.
export function messageOriginForPopupUrl(popupUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(popupUrl);
  } catch {
    return null;
  }

  const redirectUris = url.searchParams.getAll('redirect_uri');
  if (redirectUris.length !== 1) return null;

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirectUris[0]);
  } catch {
    return null;
  }

  if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
    return null;
  }
  return redirectUrl.origin;
}
