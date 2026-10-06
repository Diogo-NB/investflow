import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  KEYCLOAK_EVENT_SIGNAL,
  KeycloakEvent,
  KeycloakEventType,
} from 'keycloak-angular';
import Keycloak, { KeycloakTokenParsed } from 'keycloak-js';
import { AuthSession } from './auth-session.service';

describe('AuthSession', () => {
  const event = signal<KeycloakEvent>({
    type: KeycloakEventType.Ready,
    args: true,
  });
  const keycloak = {
    tokenParsed: undefined as KeycloakTokenParsed | undefined,
    logout: vi.fn<() => Promise<void>>(),
  };

  beforeEach(() => {
    keycloak.tokenParsed = { preferred_username: 'investflow-dev' };
    keycloak.logout.mockReset().mockResolvedValue(undefined);
    event.set({ type: KeycloakEventType.Ready, args: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: Keycloak, useValue: keycloak },
        { provide: KEYCLOAK_EVENT_SIGNAL, useValue: event.asReadonly() },
        {
          provide: DOCUMENT,
          useValue: { location: { origin: 'https://app.example.com' } },
        },
      ],
    });
  });

  it.each([
    [
      { name: 'Diogo', preferred_username: 'diogo', email: 'd@example.com' },
      'Diogo',
    ],
    [{ name: '  ', preferred_username: 'diogo' }, 'diogo'],
    [
      { name: 42, preferred_username: false, email: 'd@example.com' },
      'd@example.com',
    ],
    [undefined, 'Usuário autenticado'],
  ])('derives identity from usable token claims', (token, expected) => {
    keycloak.tokenParsed = token;
    expect(TestBed.inject(AuthSession).identity()).toBe(expected);
  });

  it('updates the identity when refreshed claims change', () => {
    const session = TestBed.inject(AuthSession);
    expect(session.identity()).toBe('investflow-dev');

    keycloak.tokenParsed = { name: 'Nome atualizado' };
    event.set({ type: KeycloakEventType.AuthRefreshSuccess });

    expect(session.identity()).toBe('Nome atualizado');
  });

  it('logs out to the app origin and stays pending while the browser redirects', async () => {
    const session = TestBed.inject(AuthSession);
    await session.logout();
    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com',
    });
    expect(session.logoutState()).toBe('pending');
  });

  it('allows retry after logout fails without exposing provider errors', async () => {
    keycloak.logout.mockRejectedValueOnce(
      new Error('sensitive provider details'),
    );
    const session = TestBed.inject(AuthSession);
    await session.logout();
    expect(session.logoutState()).toBe('error');

    await session.logout();
    expect(keycloak.logout).toHaveBeenCalledTimes(2);
    expect(session.logoutState()).toBe('pending');
  });

  it('ignores duplicate intent while logout is pending', async () => {
    let finish!: () => void;
    keycloak.logout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const session = TestBed.inject(AuthSession);
    const pending = session.logout();
    await session.logout();
    expect(keycloak.logout).toHaveBeenCalledOnce();
    expect(session.logoutState()).toBe('pending');
    finish();
    await pending;
  });
});
