# Shared Architecture

`libs/shared` is a collection of cross-context building blocks, not a bounded
context and not a deployment unit. Add code to shared only when its semantics
are genuinely context-independent; do not move feature code there merely to
make it available to more than one app.

## Public Imports

| Alias                               | Path                                      |
| ----------------------------------- | ----------------------------------------- |
| `@investflow/shared-application`    | `libs/shared/application/src/index.ts`    |
| `@investflow/shared-domain`         | `libs/shared/domain/src/index.ts`         |
| `@investflow/shared-infrastructure` | `libs/shared/infrastructure/src/index.ts` |
| `@investflow/shared-types`          | `libs/shared/types/src/index.ts`          |

Use these public aliases instead of importing internal shared-library files.

## Common Temporal Types

Temporal concepts are shared building blocks. Import `CalendarDate`,
`CalendarDateRange`, and `UtcInstant` from `@investflow/shared-domain`, and
import `Clock` from `@investflow/shared-application`. Feature contexts must not
create competing date wrappers or perform business-date logic directly with
native `Date`.

Keep native `Date` at technical boundaries only. Persistence and framework
adapters convert it immediately to or from the appropriate shared value object;
domain and application signatures remain expressed in the shared temporal
types. If a reusable operation is missing, add it to the appropriate shared
temporal value object with focused tests.

Shared infrastructure may provide NestJS, Prisma, and messaging adapters. Apps
must still choose which modules and background processes are active for their
runtime. Do not assume that an umbrella module used by the modular-monolith API
is appropriate for every future Lambda or worker.

## Authentication

Keycloak roles are generic strings. Define domain-specific roles only when the
new domain requires them.
