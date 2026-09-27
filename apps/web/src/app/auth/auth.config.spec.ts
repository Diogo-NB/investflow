import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import Keycloak from 'keycloak-js';
import {
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  includeBearerTokenInterceptor,
} from 'keycloak-angular';
import { firstValueFrom, of } from 'rxjs';
import {
  AUTH_INACTIVITY_TIMEOUT_MS,
  apiBearerTokenCondition,
  authenticationInitOptions,
  initializeAuthentication,
} from './auth.config';

describe('web authentication configuration', () => {
  it('initializes login-required Authorization Code Flow with PKCE before refresh tracking', async () => {
    const keycloak = { init: vi.fn().mockResolvedValue(true) };
    const sessionRefresher = { start: vi.fn() };

    await initializeAuthentication(
      keycloak,
      sessionRefresher,
      'https://app.example.com',
    );

    expect(keycloak.init).toHaveBeenCalledWith({
      onLoad: 'login-required',
      flow: 'standard',
      pkceMethod: 'S256',
      redirectUri: 'https://app.example.com',
    });
    expect(sessionRefresher.start).toHaveBeenCalledWith({
      sessionTimeout: AUTH_INACTIVITY_TIMEOUT_MS,
      onInactivityTimeout: 'logout',
      logoutOptions: { redirectUri: 'https://app.example.com' },
    });
    expect(keycloak.init.mock.invocationCallOrder[0]).toBeLessThan(
      sessionRefresher.start.mock.invocationCallOrder[0],
    );
  });

  it('does not start refresh tracking when initialization fails', async () => {
    const keycloak = { init: vi.fn().mockRejectedValue(new Error('raw')) };
    const sessionRefresher = { start: vi.fn() };

    await expect(
      initializeAuthentication(
        keycloak,
        sessionRefresher,
        'https://app.example.com',
      ),
    ).rejects.toThrow('raw');
    expect(sessionRefresher.start).not.toHaveBeenCalled();
  });

  it('uses the required login and PKCE settings', () => {
    expect(authenticationInitOptions('https://app.example.com')).toEqual({
      onLoad: 'login-required',
      flow: 'standard',
      pkceMethod: 'S256',
      redirectUri: 'https://app.example.com',
    });
  });

  it('refreshes and includes the bearer token only on relative API requests', async () => {
    const keycloak = {
      authenticated: true,
      token: 'access-token',
      updateToken: vi.fn().mockResolvedValue(false),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Keycloak, useValue: keycloak },
        {
          provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
          useValue: [apiBearerTokenCondition],
        },
      ],
    });
    const forwardedRequests: HttpRequest<unknown>[] = [];
    const next: HttpHandlerFn = (request) => {
      forwardedRequests.push(request);
      return of(new HttpResponse());
    };

    await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        includeBearerTokenInterceptor(
          new HttpRequest('GET', '/api/investments'),
          next,
        ),
      ),
    );
    await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        includeBearerTokenInterceptor(
          new HttpRequest('GET', 'https://reports.example.com/api/export'),
          next,
        ),
      ),
    );

    expect(keycloak.updateToken).toHaveBeenCalledOnce();
    expect(forwardedRequests[0].headers.get('Authorization')).toBe(
      'Bearer access-token',
    );
    expect(forwardedRequests[1].headers.has('Authorization')).toBe(false);
  });
});
