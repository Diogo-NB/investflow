# Investment Simulator Infrastructure

NestJS adapters and context-local composition for the Investment Simulator
bounded context. This project owns controllers, DTOs, presenters, query
handlers, Prisma repositories, mappers, listeners, and provider bindings.

`InvestmentSimulatorInfrastructureModule` is the public composition module used
by the current modular-monolith API. If future service or Lambda hosts require
different adapter sets, expose focused HTTP, messaging, persistence, or
background-work modules from this project rather than activating unrelated
adapters as import side effects.

Consumers import its public API through
`@investflow/investment-simulator-infrastructure`.

Source is organized by plural business feature. Each feature groups adapters
by boundary: for example, offer controllers, request DTOs, and HTTP validators
live in `src/lib/offers/http`, while Prisma repositories and mappers live in
`src/lib/offers/persistence`.

## Offer HTTP API

Authenticated clients can create, partially update, and soft delete offers at
`/api/investment-simulator/offers`. Creation returns the new identifier;
updates and deletions return no response body. Offer queries are intentionally
outside this command API.

## Building

Run `pnpm nx build investment-simulator-infrastructure` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-infrastructure` to execute its Jest
tests.
