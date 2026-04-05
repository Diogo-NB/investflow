export type UserRole = 'INVESTOR' | 'ORG_USER';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string | undefined;
  roles: UserRole[];
  email: string;
}
