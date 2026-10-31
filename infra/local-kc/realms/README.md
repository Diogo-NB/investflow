# Local-development realm

`investflow-realm.json` is only for local development. Docker Compose imports
it into the local Keycloak container and replaces `WEB_APP_ORIGIN` in the web
client URLs. Do not import this realm into production or any shared
environment.

The import contains the temporary local account `investflow-dev` with initial
password `investflow-dev`. Keycloak requires a password change on first login.
These credentials are intentionally public and must never be reused outside a
developer workstation.

Production infrastructure must provision its own realm, clients, and users. It
must not seed this account.

InvestFlow currently authenticates users without application roles. The local
clients do not request Keycloak's roles scope, and seeded users must not define
explicit realm or client role mappings. Keycloak's built-in management roles
remain part of the realm because they are internal Keycloak resources.

Do not add tests that parse and assert the contents of the realm import file.
Those tests duplicate Keycloak configuration without validating that Keycloak
can actually consume it. Validate the local realm through `pnpm db:setup` and
the authentication flow instead.
