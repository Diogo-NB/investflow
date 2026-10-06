import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AutoRefreshTokenService,
  KEYCLOAK_EVENT_SIGNAL,
  KeycloakEvent,
  KeycloakEventType,
  UserActivityService,
} from 'keycloak-angular';
import Keycloak from 'keycloak-js';
import {
  AUTH_INACTIVITY_TIMEOUT_MS,
  initializeAuthentication,
} from './auth.config';

describe('configured Keycloak refresh policy', () => {
  const event = signal<KeycloakEvent>({
    type: KeycloakEventType.Ready,
    args: true,
  });
  const keycloak = {
    authenticated: true,
    init: vi.fn().mockResolvedValue(true),
    updateToken: vi.fn(),
    logout: vi.fn(),
  };
  const activity = {
    startMonitoring: vi.fn(),
    isActive: vi.fn(),
  };

  beforeEach(async () => {
    event.set({ type: KeycloakEventType.Ready, args: true });
    keycloak.updateToken.mockReset().mockResolvedValue(false);
    keycloak.logout.mockReset().mockResolvedValue(undefined);
    activity.startMonitoring.mockClear();
    activity.isActive.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        AutoRefreshTokenService,
        { provide: Keycloak, useValue: keycloak },
        { provide: KEYCLOAK_EVENT_SIGNAL, useValue: event.asReadonly() },
        { provide: UserActivityService, useValue: activity },
      ],
    });
    await initializeAuthentication(
      keycloak,
      TestBed.inject(AutoRefreshTokenService),
      'https://app.example.com',
    );
    TestBed.tick();
  });

  it('refreshes active sessions when a token expires', () => {
    event.set({ type: KeycloakEventType.TokenExpired });
    TestBed.tick();

    expect(activity.startMonitoring).toHaveBeenCalledOnce();
    expect(activity.isActive).toHaveBeenCalledWith(AUTH_INACTIVITY_TIMEOUT_MS);
    expect(keycloak.updateToken).toHaveBeenCalledOnce();
    expect(keycloak.logout).not.toHaveBeenCalled();
  });

  it('logs out inactive sessions at token expiry instead of refreshing', () => {
    activity.isActive.mockReturnValue(false);
    event.set({ type: KeycloakEventType.TokenExpired });
    TestBed.tick();

    expect(keycloak.updateToken).not.toHaveBeenCalled();
    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com',
    });
  });

  it('ends the session when an active-session refresh fails', async () => {
    keycloak.updateToken.mockRejectedValue(new Error('session expired'));
    event.set({ type: KeycloakEventType.TokenExpired });
    TestBed.tick();
    await Promise.resolve();

    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com',
    });
  });
});
