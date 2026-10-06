import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { KEYCLOAK_EVENT_SIGNAL } from 'keycloak-angular';
import type { KeycloakTokenParsed } from 'keycloak-js';
import Keycloak from 'keycloak-js';

export type LogoutState = 'idle' | 'pending' | 'error';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly keycloak = inject(Keycloak);
  private readonly document = inject(DOCUMENT);
  private readonly keycloakEvent = inject(KEYCLOAK_EVENT_SIGNAL);
  private readonly writableLogoutState = signal<LogoutState>('idle');

  readonly identity = computed(() => {
    // Keycloak updates token claims outside Angular; its events invalidate this view.
    this.keycloakEvent();
    return this.authenticatedIdentity(this.keycloak.tokenParsed);
  });
  readonly logoutState = this.writableLogoutState.asReadonly();

  private stringClaim(
    token: KeycloakTokenParsed | undefined,
    claimName: string,
  ): string | undefined {
    const value: unknown = token?.[claimName];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private authenticatedIdentity(
    token: KeycloakTokenParsed | undefined,
  ): string {
    return (
      this.stringClaim(token, 'name') ??
      this.stringClaim(token, 'preferred_username') ??
      this.stringClaim(token, 'email') ??
      'Usuário autenticado'
    );
  }

  async logout(): Promise<void> {
    if (this.logoutState() === 'pending') {
      return;
    }

    this.writableLogoutState.set('pending');

    try {
      await this.keycloak.logout({
        redirectUri: this.document.location.origin,
      });
    } catch {
      this.writableLogoutState.set('error');
    }
  }
}
