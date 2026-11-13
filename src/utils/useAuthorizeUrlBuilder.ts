import { buildAuthorizeUrl } from './authorizeUrl';
import { useConnections } from './useConnections';
import { useSession } from './useSession';

// Returns a builder for authorize/re-authorize popup URLs that reads the
// session `redirect_uri`, `unifyBaseUrl` and `embedOrigin` from context. Call
// the returned function at click time so every popup gets a fresh nonce.
export const useAuthorizeUrlBuilder = (): ((
  authorizeUrl?: string | null
) => string | null) => {
  const { session } = useSession();
  const { unifyBaseUrl, embedOrigin } = useConnections();

  return (authorizeUrl?: string | null) =>
    buildAuthorizeUrl({
      authorizeUrl,
      sessionRedirectUri: session?.redirect_uri,
      unifyBaseUrl,
      embedOrigin,
    });
};
