import { JwtStrategy } from '../jwt.strategy';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn().mockReturnValue(jest.fn()),
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy({
      url: 'http://localhost:8080',
      realm: 'investflow',
      clientId: 'investflow-api',
    });
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
