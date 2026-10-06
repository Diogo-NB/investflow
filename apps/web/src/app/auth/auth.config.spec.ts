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
  initializeAuthentication,
} from './auth.config';

describe('authentication initialization', () => {
  it('requires login with PKCE before starting inactivity and refresh tracking', async () => {
    const keycloak = { init: vi.fn().mockResolvedValue(true) };
    const refresher = { start: vi.fn() };
    await initializeAuthentication(
      keycloak,
      refresher,
      'https://app.example.com',
    );
    expect(keycloak.init).toHaveBeenCalledWith({
      onLoad: 'login-required',
      flow: 'standard',
      pkceMethod: 'S256',
      redirectUri: 'https://app.example.com',
    });
    expect(refresher.start).toHaveBeenCalledWith({
      sessionTimeout: AUTH_INACTIVITY_TIMEOUT_MS,
      onInactivityTimeout: 'logout',
      logoutOptions: { redirectUri: 'https://app.example.com' },
    });
    expect(keycloak.init.mock.invocationCallOrder[0]).toBeLessThan(
      refresher.start.mock.invocationCallOrder[0],
    );
  });

  it('rejects initialization failure and does not start refresh tracking', async () => {
    const keycloak = {
      init: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    };
    const refresher = { start: vi.fn() };
    await expect(
      initializeAuthentication(keycloak, refresher, 'https://app.example.com'),
    ).rejects.toThrow();
    expect(refresher.start).not.toHaveBeenCalled();
  });

  it('returns to the requested feature route and filters while logout returns home', async () => {
    const keycloak = { init: vi.fn().mockResolvedValue(true) };
    const refresher = { start: vi.fn() };
    const url = 'https://app.example.com/ofertas/offer-id?titleType=CDB&page=2';
    await initializeAuthentication(keycloak, refresher, url);
    expect(keycloak.init).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: url }),
    );
    expect(refresher.start).toHaveBeenCalledWith(
      expect.objectContaining({
        logoutOptions: { redirectUri: 'https://app.example.com' },
      }),
    );
  });

  it('rejects an unauthenticated result and does not start refresh tracking', async () => {
    const keycloak = { init: vi.fn().mockResolvedValue(false) };
    const refresher = { start: vi.fn() };
    await expect(
      initializeAuthentication(keycloak, refresher, 'https://app.example.com'),
    ).rejects.toThrow();
    expect(refresher.start).not.toHaveBeenCalled();
  });
});

describe('API bearer boundary', () => {
  const keycloak = {
    authenticated: true,
    token: 'access-token',
    updateToken: vi.fn().mockResolvedValue(false),
  };
  beforeEach(() => {
    keycloak.updateToken.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Keycloak, useValue: keycloak },
        {
          provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
          useValue: [apiBearerTokenCondition],
        },
      ],
    });
  });

  it.each(['/api', '/api/', '/api/investments', '/api/investments?limit=1'])(
    'refreshes and forwards a token to %s',
    async (url) => {
      let forwarded!: HttpRequest<unknown>;
      const next: HttpHandlerFn = (request) => {
        forwarded = request;
        return of(new HttpResponse());
      };
      await firstValueFrom(
        TestBed.runInInjectionContext(() =>
          includeBearerTokenInterceptor(new HttpRequest('GET', url), next),
        ),
      );
      expect(keycloak.updateToken).toHaveBeenCalledOnce();
      expect(forwarded.headers.get('Authorization')).toBe(
        'Bearer access-token',
      );
    },
  );

  it.each([
    '/apiary',
    '/api-other/investments',
    'api/investments',
    '/fonts/font.woff2',
    'https://app.example.com/api/investments',
    'https://reports.example.com/api/export',
    '//reports.example.com/api/export',
  ])('never forwards a token or refreshes for %s', async (url) => {
    let forwarded!: HttpRequest<unknown>;
    const next: HttpHandlerFn = (request) => {
      forwarded = request;
      return of(new HttpResponse());
    };
    await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        includeBearerTokenInterceptor(new HttpRequest('GET', url), next),
      ),
    );
    expect(keycloak.updateToken).not.toHaveBeenCalled();
    expect(forwarded.headers.has('Authorization')).toBe(false);
  });
});
