import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import type { KeycloakTokenParsed } from 'keycloak-js';
import Keycloak from 'keycloak-js';

export type LogoutState = 'idle' | 'pending' | 'error';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly keycloak = inject(Keycloak);
  private readonly document = inject(DOCUMENT);

  readonly identity = this.authenticatedIdentity(this.keycloak.tokenParsed);
  readonly logoutState = signal<LogoutState>('idle');

  private stringClaim(
    token: KeycloakTokenParsed | undefined,
    claimName: string,
  ): string | undefined {
    const value: unknown = token?.[claimName];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private authenticatedIdentity(token: KeycloakTokenParsed | undefined): string {
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

    this.logoutState.set('pending');

    try {
      await this.keycloak.logout({
        redirectUri: this.document.location.origin,
      });
    } catch {
      this.logoutState.set('error');
    }
  }
}
