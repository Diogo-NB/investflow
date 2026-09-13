# Investment Simulator Application

Application orchestration for the Investment Simulator bounded context. This
project owns commands, use cases, application errors, and abstract-class ports.
It may use NestJS dependency-injection features but must not depend on a
specific deployment host or infrastructure implementation.

Consumers import its public API through
`@investflow/investment-simulator-application`.

## Building

Run `pnpm nx build investment-simulator-application` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-application` to execute its Jest tests.
