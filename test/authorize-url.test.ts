import {
  buildAuthorizeUrl,
  fallbackRedirectUri,
  messageOriginForPopupUrl,
} from '../src/utils/authorizeUrl';
import { REDIRECT_URL, STAGING_REDIRECT_URL } from '../src/constants/urls';

const AUTHORIZE_URL = 'https://unify.apideck.com/vault/authorize/shopify/abc';
const PRODUCTION_BASE_URL = 'https://unify.apideck.com';
const STAGING_BASE_URL =
  'https://deploy-preview-staging--unify.stagingapideck.com';

type BuildParams = Parameters<typeof buildAuthorizeUrl>[0];

// Builds with sensible defaults and parses the result, so assertions read
// searchParams instead of comparing whole strings (parameter order is not part
// of the contract).
const build = (overrides: Partial<BuildParams> = {}): URL => {
  const href = buildAuthorizeUrl({
    authorizeUrl: AUTHORIZE_URL,
    unifyBaseUrl: PRODUCTION_BASE_URL,
    ...overrides,
  });
  expect(href).not.toBeNull();
  return new URL(href as string);
};

// A popup URL whose single redirect_uri parameter is properly encoded.
const popupUrlWith = (redirectUri: string): string => {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('redirect_uri', redirectUri);
  return url.href;
};

describe('buildAuthorizeUrl', () => {
  it('keeps the path of an authorize_url without a query and adds the four parameters', () => {
    const url = build();

    expect(url.origin).toBe('https://unify.apideck.com');
    expect(url.pathname).toBe('/vault/authorize/shopify/abc');
    expect(url.searchParams.getAll('redirect_uri')).toHaveLength(1);
    expect(url.searchParams.getAll('nonce')).toHaveLength(1);
    expect(url.searchParams.getAll('opener_origin')).toHaveLength(1);
    expect(url.searchParams.getAll('embed_origin')).toHaveLength(1);
  });

  it('keeps the existing state parameter unchanged', () => {
    const state = 'eyJhbGciOi.eyJzdWIi.sig-_x';
    const href = buildAuthorizeUrl({
      authorizeUrl: `${AUTHORIZE_URL}?state=${state}`,
      unifyBaseUrl: PRODUCTION_BASE_URL,
    });

    expect(href).not.toBeNull();
    const url = new URL(href as string);
    expect(url.searchParams.get('state')).toBe(state);
    expect(href).toContain(`state=${state}`);
  });

  it('replaces a redirect_uri already present in authorize_url', () => {
    const url = build({
      authorizeUrl: `${AUTHORIZE_URL}?redirect_uri=http://localhost:3000`,
      sessionRedirectUri: 'https://app.example.com/callback',
    });

    expect(url.searchParams.getAll('redirect_uri')).toEqual([
      'https://app.example.com/callback',
    ]);
  });

  it('uses the session redirect_uri when present', () => {
    const url = build({
      sessionRedirectUri: 'https://connect.customer.example/oauth/callback',
    });

    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://connect.customer.example/oauth/callback'
    );
  });

  it('encodes a session redirect_uri that has its own query and fragment', () => {
    const sessionRedirectUri = 'https://app.example.com/cb?x=1&y=2#f';
    const url = build({ sessionRedirectUri });

    expect(url.searchParams.get('redirect_uri')).toBe(sessionRedirectUri);
    expect(url.searchParams.has('y')).toBe(false);
    expect(url.hash).toBe('');
  });

  it('sends a session redirect_uri that is not a URL verbatim', () => {
    const url = build({ sessionRedirectUri: 'not a url' });

    expect(url.searchParams.get('redirect_uri')).toBe('not a url');
  });

  it('sends an empty session redirect_uri verbatim', () => {
    const url = build({ sessionRedirectUri: '' });

    expect(url.searchParams.getAll('redirect_uri')).toEqual(['']);
  });

  it('uses the fallback callback page when the session redirect_uri is undefined', () => {
    const url = build({
      sessionRedirectUri: undefined,
      unifyBaseUrl: PRODUCTION_BASE_URL,
    });

    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URL);
  });

  it('uses the staging callback page when the session redirect_uri is undefined and unifyBaseUrl is staging', () => {
    const url = build({
      sessionRedirectUri: undefined,
      unifyBaseUrl: STAGING_BASE_URL,
    });

    expect(url.searchParams.get('redirect_uri')).toBe(STAGING_REDIRECT_URL);
  });

  it('sets opener_origin to window.location.origin', () => {
    const url = build();

    expect(url.searchParams.get('opener_origin')).toBe(window.location.origin);
  });

  it('sets opener_origin to window.location.origin even when embedOrigin is given', () => {
    const url = build({ embedOrigin: 'https://customer.example' });

    expect(url.searchParams.get('opener_origin')).toBe(window.location.origin);
  });

  it('sets embed_origin to embedOrigin when given', () => {
    const url = build({ embedOrigin: 'https://customer.example' });

    expect(url.searchParams.get('embed_origin')).toBe(
      'https://customer.example'
    );
  });

  it("sends embedOrigin 'null' verbatim", () => {
    const url = build({ embedOrigin: 'null' });

    expect(url.searchParams.get('embed_origin')).toBe('null');
  });

  it("sends an empty embedOrigin as 'null'", () => {
    const url = build({ embedOrigin: '' });

    expect(url.searchParams.get('embed_origin')).toBe('null');
  });

  it('defaults embed_origin to window.location.origin when embedOrigin is undefined', () => {
    const url = build({ embedOrigin: undefined });

    expect(url.searchParams.get('embed_origin')).toBe(window.location.origin);
  });

  it('adds a non-empty nonce that differs between calls', () => {
    const first = build().searchParams.get('nonce');
    const second = build().searchParams.get('nonce');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('returns null when authorize_url is null or undefined', () => {
    expect(
      buildAuthorizeUrl({
        authorizeUrl: null,
        unifyBaseUrl: PRODUCTION_BASE_URL,
      })
    ).toBeNull();
    expect(
      buildAuthorizeUrl({
        authorizeUrl: undefined,
        unifyBaseUrl: PRODUCTION_BASE_URL,
      })
    ).toBeNull();
  });

  it('returns null when authorize_url is not an absolute URL', () => {
    expect(
      buildAuthorizeUrl({
        authorizeUrl: '/vault/authorize/x',
        unifyBaseUrl: PRODUCTION_BASE_URL,
      })
    ).toBeNull();
  });
});

describe('fallbackRedirectUri', () => {
  it('returns the production callback page when unifyBaseUrl is undefined', () => {
    expect(fallbackRedirectUri(undefined)).toBe(REDIRECT_URL);
  });

  it('returns the production callback page for https://unify.apideck.com', () => {
    expect(fallbackRedirectUri('https://unify.apideck.com')).toBe(REDIRECT_URL);
  });

  it('returns the staging callback page for https://deploy-preview-staging--unify.stagingapideck.com', () => {
    expect(fallbackRedirectUri(STAGING_BASE_URL)).toBe(STAGING_REDIRECT_URL);
  });

  it('returns the production callback page for a host that only contains stagingapideck.com', () => {
    expect(fallbackRedirectUri('https://stagingapideck.com.evil.example')).toBe(
      REDIRECT_URL
    );
  });

  it('returns the production callback page for http://localhost:3050', () => {
    expect(fallbackRedirectUri('http://localhost:3050')).toBe(REDIRECT_URL);
  });

  it('returns the production callback page for a malformed unifyBaseUrl', () => {
    expect(fallbackRedirectUri('not a url')).toBe(REDIRECT_URL);
  });
});

describe('messageOriginForPopupUrl', () => {
  it('returns the origin of the Apideck callback page', () => {
    expect(messageOriginForPopupUrl(popupUrlWith(REDIRECT_URL))).toBe(
      'https://vault.apideck.com'
    );
  });

  it('returns the origin of the staging callback page', () => {
    expect(messageOriginForPopupUrl(popupUrlWith(STAGING_REDIRECT_URL))).toBe(
      'https://vault.stagingapideck.com'
    );
  });

  it('returns the origin of a custom callback page, port included', () => {
    expect(
      messageOriginForPopupUrl(
        popupUrlWith('https://connect.customer.example:8443/oauth/callback')
      )
    ).toBe('https://connect.customer.example:8443');
  });

  it('returns the redirect_uri origin of a URL built by buildAuthorizeUrl', () => {
    const href = buildAuthorizeUrl({
      authorizeUrl: `${AUTHORIZE_URL}?state=s`,
      sessionRedirectUri: 'https://app.example.com/cb?x=1&y=2#f',
      unifyBaseUrl: PRODUCTION_BASE_URL,
    });

    expect(href).not.toBeNull();
    expect(messageOriginForPopupUrl(href as string)).toBe(
      'https://app.example.com'
    );
  });

  it('reads the redirect_uri of a revoke URL built by concatenation', () => {
    expect(
      messageOriginForPopupUrl(
        'https://unify.apideck.com/vault/revoke/x/y?state=s&redirect_uri=https://vault.apideck.com/oauth/callback'
      )
    ).toBe('https://vault.apideck.com');
  });

  it('returns null when the popup URL has no redirect_uri', () => {
    expect(messageOriginForPopupUrl(`${AUTHORIZE_URL}?state=s`)).toBeNull();
  });

  it('returns null when the popup URL has more than one redirect_uri', () => {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.append('redirect_uri', 'https://vault.apideck.com/cb');
    url.searchParams.append('redirect_uri', 'https://evil.example/cb');

    expect(messageOriginForPopupUrl(url.href)).toBeNull();
  });

  it('returns null when redirect_uri is not a URL', () => {
    expect(messageOriginForPopupUrl(popupUrlWith('not a url'))).toBeNull();
  });

  it('returns null for a redirect_uri that is not http or https', () => {
    expect(
      messageOriginForPopupUrl(popupUrlWith('data:text/plain,x'))
    ).toBeNull();
    expect(
      messageOriginForPopupUrl(popupUrlWith('myapp://callback'))
    ).toBeNull();
  });

  it('returns null when the popup URL itself is not a URL', () => {
    expect(messageOriginForPopupUrl('not a url')).toBeNull();
  });
});
