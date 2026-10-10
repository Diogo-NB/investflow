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

`CalculateSimulationUseCase` is the one write path for simulation inputs. It
verifies the issuer, the optional curve, and, for a new simulation, the source
catalog offer; calculates the inputs; and only on success creates the
simulation (on its first calculation) and appends the calculation in the same
transaction. `DeleteSimulationUseCase` soft deletes an owned simulation.

Application behavior is organized as vertical slices under `offers/create`,
`offers/update`, `offers/delete`, `simulations/calculate`, and
`simulations/delete`. Contracts and conversion helpers shared by
multiple operations live under `offers/shared`; feature-wide ports and errors
remain at the feature root.

## Building

Run `pnpm nx build investment-simulator-application` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-application` to execute its Jest tests.
