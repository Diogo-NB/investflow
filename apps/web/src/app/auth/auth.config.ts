import { DOCUMENT } from '@angular/common';
import { provideAppInitializer, inject } from '@angular/core';
import type { KeycloakInitOptions } from 'keycloak-js';
import Keycloak from 'keycloak-js';
import {
  AutoRefreshTokenService,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  IncludeBearerTokenCondition,
  UserActivityService,
  createInterceptorCondition,
  provideKeycloak,
} from 'keycloak-angular';
import { environment } from '../../environments/environment';

export const AUTH_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1_000;

export const apiBearerTokenCondition =
  createInterceptorCondition<IncludeBearerTokenCondition>({
    urlPattern: /^\/api(?:\/|$)/,
  });

interface KeycloakInitializer {
  init(options: KeycloakInitOptions): Promise<boolean>;
}

interface SessionRefresher {
  start(options: {
    sessionTimeout: number;
    onInactivityTimeout: 'logout';
    logoutOptions: { redirectUri: string };
  }): void;
}

export function authenticationInitOptions(
  applicationUrl: string,
): KeycloakInitOptions {
  return {
    onLoad: 'login-required',
    flow: 'standard',
    pkceMethod: 'S256',
    redirectUri: applicationUrl,
  };
}

export async function initializeAuthentication(
  keycloak: KeycloakInitializer,
  sessionRefresher: SessionRefresher,
  applicationUrl: string,
): Promise<void> {
  const authenticated = await keycloak.init(
    authenticationInitOptions(applicationUrl),
  );

  if (!authenticated) {
    throw new Error('Keycloak did not establish an authenticated session.');
  }

  sessionRefresher.start({
    sessionTimeout: AUTH_INACTIVITY_TIMEOUT_MS,
    onInactivityTimeout: 'logout',
    logoutOptions: { redirectUri: new URL(applicationUrl).origin },
  });
}

export function provideWebAuthentication() {
  return [
    // The library's initializer catches init errors; our initializer must reject
    // so an unavailable identity provider never opens the authenticated shell.
    provideKeycloak({
      config: environment.keycloak,
      providers: [AutoRefreshTokenService, UserActivityService],
    }),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [apiBearerTokenCondition],
    },
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      return initializeAuthentication(
        inject(Keycloak),
        inject(AutoRefreshTokenService),
        `${document.location.origin}${document.location.pathname}${document.location.search}`,
      );
    }),
  ];
}
