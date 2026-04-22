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
      realm_access: { roles: ['INVESTOR', 'offline_access'] },
    });

    expect(result).toEqual({
      userId: 'user-uuid',
      organizationId: 'd4e5f6a7-b8c9-0123-defa-234567890321',
      roles: ['INVESTOR'],
      email: '',
    });
  });

  it('merges client roles with realm roles and filters to known roles', () => {
    const result = strategy.validate({
      sub: 'org-user-uuid',
      realm_access: { roles: ['offline_access'] },
      resource_access: { 'investflow-api': { roles: ['ORG_USER'] } },
      organization_id: 'org-uuid',
      email: 'org@test.com',
    });

    expect(result).toEqual({
      userId: 'org-user-uuid',
      organizationId: 'org-uuid',
      roles: ['ORG_USER'],
      email: 'org@test.com',
    });
  });

  it('strips unknown roles', () => {
    const result = strategy.validate({
      sub: 'user-uuid',
      realm_access: { roles: ['uma_authorization', 'INVESTOR', 'some-unknown-role'] },
    });

    expect(result.roles).toEqual(['INVESTOR']);
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
    expect(result.organizationId).toBe('d4e5f6a7-b8c9-0123-defa-234567890321');
  });
});
