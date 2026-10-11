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

`StartSimulationUseCase` verifies the source catalog offer and the issuer when
given and the optional curve, then saves the simulation and its first
calculation from `Simulation.start()` in the same transaction.
`CalculateSimulationUseCase` loads an owned simulation and the optional curve
and appends the calculation `Simulation.calculate()` returns. Neither saves
anything when the calculation is rejected. `DeleteSimulationUseCase` soft
deletes an owned simulation. Offer creation checks the issuer only when one is
given.

Application behavior is organized as vertical slices under `offers/create`,
`offers/update`, `offers/delete`, `simulations/start`,
`simulations/calculate`, and `simulations/delete`. Contracts and conversion helpers shared by
multiple operations live under `offers/shared`; feature-wide ports and errors
remain at the feature root.

## Building

Run `pnpm nx build investment-simulator-application` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-application` to execute its Jest tests.
