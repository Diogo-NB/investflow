import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import { AuthSession, authenticatedIdentity } from './auth-session.service';

describe('AuthSession', () => {
  it('chooses a safe authenticated identity', () => {
    expect(authenticatedIdentity({ name: 'Maria Silva' })).toBe('Maria Silva');
    expect(authenticatedIdentity({ preferred_username: 'maria' })).toBe(
      'maria',
    );
    expect(authenticatedIdentity(undefined)).toBe('Usuário autenticado');
  });

  it('logs out to the application origin', async () => {
    const keycloak = {
      tokenParsed: { preferred_username: 'investflow-dev' },
      logout: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        AuthSession,
        { provide: Keycloak, useValue: keycloak },
        {
          provide: DOCUMENT,
          useValue: { location: { origin: 'https://app.example.com' } },
        },
      ],
    });
    const session = TestBed.inject(AuthSession);

    await session.logout();

    expect(session.identity).toBe('investflow-dev');
    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com',
    });
    expect(session.logoutState()).toBe('pending');
  });

  it('exposes a safe error state when logout fails', async () => {
    const keycloak = {
      tokenParsed: {},
      logout: vi.fn().mockRejectedValue(new Error('sensitive details')),
    };
    TestBed.configureTestingModule({
      providers: [
        AuthSession,
        { provide: Keycloak, useValue: keycloak },
        {
          provide: DOCUMENT,
          useValue: { location: { origin: 'https://app.example.com' } },
        },
      ],
    });
    const session = TestBed.inject(AuthSession);

    await session.logout();

    expect(session.logoutState()).toBe('error');
  });

  it('ignores repeated logout intent while logout is pending', async () => {
    const logout = vi.fn(() => new Promise<void>(() => undefined));
    const keycloak = { tokenParsed: {}, logout };
    TestBed.configureTestingModule({
      providers: [
        AuthSession,
        { provide: Keycloak, useValue: keycloak },
        {
          provide: DOCUMENT,
          useValue: { location: { origin: 'https://app.example.com' } },
        },
      ],
    });
    const session = TestBed.inject(AuthSession);

    void session.logout();
    await session.logout();

    expect(logout).toHaveBeenCalledOnce();
    expect(session.logoutState()).toBe('pending');
  });
});
