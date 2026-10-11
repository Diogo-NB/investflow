# shared-infrastructure

Cross-context NestJS infrastructure building blocks, including authentication,
Prisma transaction support, HTTP error translation, and the outbox with its
EventBridge and SQS adapters. This is shared technical infrastructure, not a bounded context or a
deployable application.

Source is organized by reusable capability: authentication adapters live under
`src/lib/authentication`, HTTP concerns under `src/lib/http`, temporal adapters
under `src/lib/dates`, monetary presentation under `src/lib/money`,
transactional persistence under `src/lib/persistence`, and broker adapters
under `src/lib/messaging`. Provider-specific boundaries remain nested, such as
`persistence/prisma`, `messaging/eventbridge`, and `messaging/sqs`.

`SharedInfrastructureModule` is the current convenience composition module for
the modular-monolith API. It activates configuration, Prisma, and
authentication; it starts no background work. A host activates scheduled
outbox publishing by importing `OutboxModule` and message consumers through
`SqsConsumersModule.register()`, so a future Lambda, queue worker, or
independent service imports only what its lifecycle supports.

## Temporal boundaries

Native `Date` is permitted only where a database driver, framework, or `Intl`
API requires it. Convert native values to `UtcInstant` or `CalendarDate` as soon
as they enter the application, and convert back only at the outgoing adapter by
using the defensive `UtcInstant.date` getter. Infrastructure code must not use
native `Date` for business rules.

Use `SystemClock` through the shared application `Clock` port for the current
time. For presentation, use the exported PT-BR temporal formatters and always
provide an explicit IANA timezone when formatting a `UtcInstant`.

## Building

Run `pnpm nx build shared-infrastructure` to build the library.

## Running unit tests

Run `pnpm nx test shared-infrastructure` to execute its Jest tests.
