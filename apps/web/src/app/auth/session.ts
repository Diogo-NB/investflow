import type Keycloak from 'keycloak-js';
import type { KeycloakTokenParsed } from 'keycloak-js';

export const AUTH_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1_000;

const ACTIVITY_EVENTS = [
  'mousemove',
  'touchstart',
  'keydown',
  'click',
  'scroll',
] as const;

export type SessionClient = Pick<
  Keycloak,
  | 'init'
  | 'updateToken'
  | 'logout'
  | 'tokenParsed'
  | 'onTokenExpired'
  | 'onAuthSuccess'
  | 'onAuthRefreshSuccess'
  | 'onAuthLogout'
>;

/** External store over an authenticated Keycloak session, read by React through `useSyncExternalStore`. */
export interface AuthSession {
  subscribe(onChange: () => void): () => void;
  tokenClaims(): KeycloakTokenParsed | undefined;
  logout(): Promise<void>;
}

/**
 * Requires a Keycloak login (Authorization Code + PKCE) and resolves only with an
 * authenticated session; tokens stay inside the Keycloak client's memory.
 */
export async function startAuthentication(
  keycloak: SessionClient,
  location: Pick<Location, 'origin' | 'pathname' | 'search'>,
  activityTarget: EventTarget = window,
): Promise<AuthSession> {
  const authenticated = await keycloak.init({
    onLoad: 'login-required',
    flow: 'standard',
    pkceMethod: 'S256',
    // Return to the requested route and filters; the fragment carries Keycloak's callback.
    redirectUri: `${location.origin}${location.pathname}${location.search}`,
  });

  if (!authenticated) {
    throw new Error('Keycloak did not establish an authenticated session.');
  }

  const logout = () => keycloak.logout({ redirectUri: location.origin });
  const endSession = () => logout().catch(() => undefined);

  let lastActivityAt = Date.now();
  const recordActivity = () => {
    lastActivityAt = Date.now();
  };
  for (const type of ACTIVITY_EVENTS) {
    activityTarget.addEventListener(type, recordActivity, { passive: true });
  }

  // Expiry-driven policy: active users refresh silently, inactive users are signed out.
  keycloak.onTokenExpired = () => {
    if (Date.now() - lastActivityAt >= AUTH_INACTIVITY_TIMEOUT_MS) {
      void endSession();
      return;
    }
    keycloak.updateToken().catch(endSession);
  };

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  keycloak.onAuthSuccess = notify;
  keycloak.onAuthRefreshSuccess = notify;
  keycloak.onAuthLogout = notify;

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    tokenClaims: () => keycloak.tokenParsed,
    logout,
  };
}
