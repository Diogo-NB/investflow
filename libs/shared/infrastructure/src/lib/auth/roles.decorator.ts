import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@investflow/shared-types';

export const ROLES_KEY = 'ROLES';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
