# Browser Authentication

Read before changing Keycloak startup, token refresh, `authorizedFetch`,
identity, inactivity, or logout.

Application-wide authentication lives in the app. Use `keycloak-js` directly
with the existing public client `investflow-web` and realm `investflow`. Use
Authorization Code Flow with PKCE S256 and `login-required`. No application
roles or custom credential form are introduced.

- `main.tsx` awaits `startAuthentication()` (`app/auth/session.ts`) before it
  creates the router and calls `createRoot().render()`. A rejected init or a
  `false` authenticated result reveals the static failure markup in
  `index.html` with a reload action, so the shell never renders
  unauthenticated. The router is created after init because init removes
  Keycloak's callback fragment from the URL.
- Login returns to the current pathname and query string, preserving direct
  offer links and filters across reloads. Fragments are excluded.
- Tokens stay in memory. Never persist access, refresh, or ID tokens in
  application storage or cookies.
- `authorizedFetch`, added with the first API consumer, attaches the bearer
  only to `/api` and `/api/...`. Absolute URLs, protocol-relative URLs, and
  lookalike prefixes get no token. It calls `updateToken` before sending.
- Refresh tracking starts only after successful init. When a token expires,
  active users refresh and users inactive for 30 minutes log out. This is an
  expiry-driven policy, not an independent wall-clock timer.
- `startAuthentication` resolves an `AuthSession` external store (subscribe,
  token claims, logout) that `main.tsx` provides through `AuthSessionContext`.
  `useIdentity()` reads it with `useSyncExternalStore`. `useLogout()` keeps the
  logout status in local state, because only the logout control needs it.
- Logout redirects to the app origin. A failed logout shows safe text and
  permits retry. Duplicate pending logout intent is ignored.
