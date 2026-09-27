import { bootstrapWebApplication } from './bootstrap';
import { renderAuthenticationInitializationFailure } from './app/auth/auth-initialization-failure';

bootstrapWebApplication().catch(() =>
  renderAuthenticationInitializationFailure(document),
);
