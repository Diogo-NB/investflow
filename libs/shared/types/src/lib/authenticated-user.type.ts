export type UserRole = string;

export interface AuthenticatedUser {
  userId: string;
  roles: UserRole[];
  email: string;
}
