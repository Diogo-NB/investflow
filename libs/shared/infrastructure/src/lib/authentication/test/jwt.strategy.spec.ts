import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../jwt.strategy';

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

  it('maps token identity to AuthenticatedUser', () => {
    const result = strategy.validate({
      sub: 'user-uuid',
      email: 'user@test.com',
    });

    expect(result).toEqual({
      userId: 'user-uuid',
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
});
