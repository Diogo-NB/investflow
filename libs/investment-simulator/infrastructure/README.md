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

## Building

Run `pnpm nx build investment-simulator-infrastructure` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-infrastructure` to execute its Jest
tests.
