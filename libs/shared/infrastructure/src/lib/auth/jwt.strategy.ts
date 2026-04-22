import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthenticatedUser, UserRole } from '@investflow/shared-types';

interface KeycloakJwtPayload {
  sub: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  organization_id?: string;
  email?: string;
  preferred_username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;

  constructor(config: ConfigService) {
    const keycloakUrl = config.getOrThrow<string>('KEYCLOAK_URL');
    const realm = config.getOrThrow<string>('KEYCLOAK_REALM');
    const clientId = config.getOrThrow<string>('KEYCLOAK_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      issuer: `${keycloakUrl}/realms/${realm}`,
      audience: clientId,
      algorithms: ['RS256'],
    });

    this.clientId = clientId;
  }

  validate(payload: KeycloakJwtPayload): AuthenticatedUser {
    const realmRoles: string[] = payload.realm_access?.roles ?? [];
    const clientRoles: string[] =
      payload.resource_access?.[this.clientId]?.roles ?? [];
    const allRoles = [...realmRoles, ...clientRoles];

    const roles = allRoles.filter(
      (r): r is UserRole => r === 'INVESTOR' || r === 'ORG_USER',
    );

    return {
      userId: payload.sub,
      organizationId: payload.organization_id,
      roles,
      email: payload.email ?? payload.preferred_username ?? '',
    };
  }
}
