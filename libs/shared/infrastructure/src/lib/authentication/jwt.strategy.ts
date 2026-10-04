import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthenticatedUser } from '@investflow/shared-types';

interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
  }

  validate(payload: KeycloakJwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email ?? payload.preferred_username ?? '',
    };
  }
}
