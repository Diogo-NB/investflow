import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { keycloakConfig, type KeycloakConfig } from './keycloak.config';

interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(keycloakConfig.KEY) config: KeycloakConfig) {
    const realmUrl = `${config.url}/realms/${config.realm}`;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${realmUrl}/protocol/openid-connect/certs`,
      }),
      issuer: realmUrl,
      audience: config.clientId,
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
