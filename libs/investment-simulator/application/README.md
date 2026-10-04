# Investment Simulator Application

Application orchestration for the Investment Simulator bounded context. This
project owns commands, use cases, application errors, and abstract-class ports.
It may use NestJS dependency-injection features but must not depend on a
specific deployment host or infrastructure implementation.

Consumers import its public API through
`@investflow/investment-simulator-application`.

## Offer commands

The offer catalog exposes use cases to create, partially update, and soft
delete offers. Creation verifies that the referenced issuer exists. Empty or
identical updates preserve domain values and still persist the aggregate.

Application behavior is organized as vertical slices under `offers/create`,
`offers/update`, and `offers/delete`. Contracts and conversion helpers shared by
multiple operations live under `offers/shared`; feature-wide ports and errors
remain at the feature root.

## Building

Run `pnpm nx build investment-simulator-application` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-application` to execute its Jest tests.
