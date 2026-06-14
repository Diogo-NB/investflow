import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

const makeContext = (user?: AuthenticatedUser, requiredRoles?: string[]) => {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key) =>
      key === ROLES_KEY ? requiredRoles : undefined,
    );

  const context: ExecutionContext = {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  } as unknown as ExecutionContext;

  return { guard: new RolesGuard(reflector), context };
};

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const { guard, context } = makeContext(undefined, []);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user has required role', () => {
    const user: AuthenticatedUser = {
      userId: 'u1',
      roles: ['reader'],
      email: '',
    };
    const { guard, context } = makeContext(user, ['reader']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role', () => {
    const user: AuthenticatedUser = {
      userId: 'u1',
      roles: ['reader'],
      email: '',
    };
    const { guard, context } = makeContext(user, ['writer']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is not set', () => {
    const { guard, context } = makeContext(undefined, ['reader']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
