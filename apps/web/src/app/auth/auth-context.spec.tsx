import { act, renderHook } from '@testing-library/react';
import type { KeycloakTokenParsed } from 'keycloak-js';
import type { ReactNode } from 'react';
import { AuthSessionContext, useIdentity, useLogout } from './auth-context';
import type { AuthSession } from './session';

function fakeSession(claims?: KeycloakTokenParsed) {
  const listeners = new Set<() => void>();
  let current = claims;
  const session = {
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    tokenClaims: () => current,
    logout: vi.fn<AuthSession['logout']>().mockResolvedValue(undefined),
    refreshClaims(next: KeycloakTokenParsed) {
      current = next;
      listeners.forEach((listener) => listener());
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthSessionContext value={session}>{children}</AuthSessionContext>
  );
  return { session, wrapper };
}

describe('useIdentity', () => {
  it.each<[KeycloakTokenParsed | undefined, string]>([
    [{ name: 'Ana', preferred_username: 'ana', email: 'a@example.com' }, 'Ana'],
    [{ name: '  ', preferred_username: 'ana' }, 'ana'],
    [
      { name: 42, preferred_username: false, email: 'a@example.com' },
      'a@example.com',
    ],
    [undefined, 'Usuário autenticado'],
  ])('shows the first usable claim of %o as %s', (claims, expected) => {
    const { wrapper } = fakeSession(claims);

    const { result } = renderHook(useIdentity, { wrapper });

    expect(result.current).toBe(expected);
  });

  it('follows refreshed claims', () => {
    const { session, wrapper } = fakeSession({ preferred_username: 'ana' });
    const { result } = renderHook(useIdentity, { wrapper });

    act(() => session.refreshClaims({ name: 'Ana Souza' }));

    expect(result.current).toBe('Ana Souza');
  });
});

describe('useLogout', () => {
  it('stays pending while the browser leaves for Keycloak', async () => {
    const { session, wrapper } = fakeSession();
    const { result } = renderHook(useLogout, { wrapper });

    await act(async () => result.current.logout());

    expect(session.logout).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('pending');
  });

  it('ignores repeated intent while pending', async () => {
    const { session, wrapper } = fakeSession();
    session.logout.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(useLogout, { wrapper });

    await act(async () => result.current.logout());
    await act(async () => result.current.logout());

    expect(session.logout).toHaveBeenCalledOnce();
  });

  it('reports a failure and allows a retry', async () => {
    const { session, wrapper } = fakeSession();
    session.logout.mockRejectedValueOnce(new Error('provider details'));
    const { result } = renderHook(useLogout, { wrapper });

    await act(async () => result.current.logout());
    expect(result.current.status).toBe('error');

    await act(async () => result.current.logout());
    expect(session.logout).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('pending');
  });
});
