# Investment Simulator Domain

Framework-free business rules for the Investment Simulator bounded context.
This project owns aggregates, value objects, domain services, events, and
domain errors. It must not import NestJS, Prisma, AWS SDKs, application code, or
infrastructure code.

Consumers import its public API through
`@investflow/investment-simulator-domain`.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
