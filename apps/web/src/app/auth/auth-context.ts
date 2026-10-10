import type { KeycloakTokenParsed } from 'keycloak-js';
import { createContext, use, useState, useSyncExternalStore } from 'react';
import type { AuthSession } from './session';

export const AuthSessionContext = createContext<AuthSession | null>(null);

export type LogoutStatus = 'idle' | 'pending' | 'error';

function useAuthSession(): AuthSession {
  const session = use(AuthSessionContext);
  if (!session) {
    throw new Error('useAuthSession requires an AuthSessionContext provider.');
  }
  return session;
}

function stringClaim(
  claims: KeycloakTokenParsed | undefined,
  name: string,
): string | undefined {
  const value: unknown = claims?.[name];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function displayIdentity(claims: KeycloakTokenParsed | undefined): string {
  return (
    stringClaim(claims, 'name') ??
    stringClaim(claims, 'preferred_username') ??
    stringClaim(claims, 'email') ??
    'Usuário autenticado'
  );
}

/** The signed-in user's display name, kept current across token refreshes. */
export function useIdentity(): string {
  const session = useAuthSession();
  return useSyncExternalStore(session.subscribe, () =>
    displayIdentity(session.tokenClaims()),
  );
}

export function useLogout(): { status: LogoutStatus; logout: () => void } {
  const session = useAuthSession();
  const [status, setStatus] = useState<LogoutStatus>('idle');

  async function logout() {
    if (status === 'pending') {
      return;
    }
    setStatus('pending');
    try {
      // Success navigates away, so the status stays pending until the page unloads.
      await session.logout();
    } catch {
      setStatus('error');
    }
  }

  return { status, logout: () => void logout() };
}
