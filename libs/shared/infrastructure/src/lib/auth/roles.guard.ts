import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser, UserRole } from '@investflow/shared-types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    if (!requiredRoles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
