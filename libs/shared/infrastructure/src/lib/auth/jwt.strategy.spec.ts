import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

const mockConfig = {
  getOrThrow: (key: string) => {
    const map: Record<string, string> = {
      KEYCLOAK_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'investflow',
      KEYCLOAK_CLIENT_ID: 'investflow-api',
    };
    return map[key];
  },
};

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn().mockReturnValue(jest.fn()),
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfig as unknown as ConfigService);
  });

  it('maps realm roles to AuthenticatedUser', () => {
    const result = strategy.validate({
      sub: 'user-uuid',
      realm_access: { roles: ['reader', 'offline_access'] },
    });

    expect(result).toEqual({
      userId: 'user-uuid',
      roles: ['reader', 'offline_access'],
      email: '',
    });
  });

  it('merges and deduplicates client roles with realm roles', () => {
    const result = strategy.validate({
      sub: 'user-uuid',
      realm_access: { roles: ['reader'] },
      resource_access: { 'investflow-api': { roles: ['reader', 'writer'] } },
      email: 'user@test.com',
    });

    expect(result).toEqual({
      userId: 'user-uuid',
      roles: ['reader', 'writer'],
      email: 'user@test.com',
    });
  });

  it('falls back to preferred_username when email is absent', () => {
    const result = strategy.validate({
      sub: 'user-uuid',
      preferred_username: 'user@example.com',
    });

    expect(result.email).toBe('user@example.com');
  });

  it('returns empty roles when no role claims present', () => {
    const result = strategy.validate({ sub: 'user-uuid' });

    expect(result.roles).toEqual([]);
  });
});
