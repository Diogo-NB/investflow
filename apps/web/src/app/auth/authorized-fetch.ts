import type Keycloak from 'keycloak-js';

export type TokenClient = Pick<Keycloak, 'updateToken' | 'token'>;

// Seconds of validity a token must still have before a request uses it.
const MIN_TOKEN_VALIDITY_SECONDS = 30;

/** True only for the app's own relative API: `/api` and `/api/...`. */
export function isApiRequest(url: string): boolean {
  return url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');
}

export function createAuthorizedFetch(
  keycloak: TokenClient,
  send: typeof fetch = (input, init) => fetch(input, init),
) {
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    if (!isApiRequest(url)) return send(url, init);
    await keycloak.updateToken(MIN_TOKEN_VALIDITY_SECONDS);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${keycloak.token}`);
    return send(url, { ...init, headers });
  };
}
