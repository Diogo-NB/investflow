# Shared Architecture

## Public Imports

| Alias                               | Path                                      |
| ----------------------------------- | ----------------------------------------- |
| `@investflow/shared-application`    | `libs/shared/application/src/index.ts`    |
| `@investflow/shared-domain`         | `libs/shared/domain/src/index.ts`         |
| `@investflow/shared-infrastructure` | `libs/shared/infrastructure/src/index.ts` |
| `@investflow/shared-types`          | `libs/shared/types/src/index.ts`          |

Use these public aliases instead of importing internal shared-library files.

## Authentication

Keycloak roles are generic strings. Define domain-specific roles only when the
new domain requires them.
