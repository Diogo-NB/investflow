import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  const mockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn().mockReturnValue({}),
      getClass: jest.fn().mockReturnValue({}),
      switchToHttp: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('bypasses JWT validation when @Public() is set', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => (key === IS_PUBLIC_KEY ? true : undefined));

    const result = guard.canActivate(mockContext());

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when user is falsy', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when error is present', () => {
    expect(() => guard.handleRequest(new Error('token expired'), null)).toThrow(
      UnauthorizedException,
    );
  });

  it('returns user when valid', () => {
    const user = { userId: 'user-uuid', roles: ['INVESTOR'] };
    const result = guard.handleRequest(null, user);
    expect(result).toBe(user);
  });
});
