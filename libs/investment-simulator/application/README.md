# Investment Simulator Application

Application orchestration for the Investment Simulator bounded context. This
project owns commands, use cases, application errors, and abstract-class ports.
It may use NestJS dependency-injection features but must not depend on a
specific deployment host or infrastructure implementation.

Consumers import its public API through
`@investflow/investment-simulator-application`.

## Offer commands

The offer catalog exposes use cases to create, partially update, and soft
delete offers. The issuer is an optional free-text name. Empty or
identical updates preserve domain values and still persist the aggregate.

## Simulation commands

Create and edit resolve the offer (an existing visible one or typed terms for a
new private offer) and the optional curve, validate them with
`SimulationCalculationService.validate()`, and save the simulation waiting for
its calculation; nothing is calculated in the request and nothing is saved when
validation fails. Edit returns the new revision. `RecalculateSimulationUseCase`
queues the calculation again ("Tentar novamente"). User commands read through
`SimulationRepository.findOwned()`.

`CalculateSimulationUseCase` runs for each queued calculation: it reads the
current simulation, offer, and curve, records the outcome, and saves it. A
deleted simulation or an outcome made stale by a newer change succeeds without
effect so the message is acknowledged; a deleted offer or curve is recorded as
an invalid outcome; any other error is returned so the queue retries.
`FailSimulationCalculationUseCase` marks a calculation still pending as failed
once the queue gives up.

Application behavior is organized as vertical slices per operation, such as
`offers/create`, `simulations/edit`, and `simulations/calculate`. Contracts
shared by multiple operations live under `<feature>/shared`; feature-wide ports
and errors remain at the feature root.

## Building

Run `pnpm nx build investment-simulator-application` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-application` to execute its Jest tests.
