# Class Design

## Aggregates And Entities

- Store state in private props objects.
- Expose state through getters.
- Mutate state only through behavior methods.
- Use static factories for creation and reconstitution.
- Raise immutable past-tense events through aggregate methods.
- Mutating aggregate methods stamp `updatedAt` and return `this` when there is
  no distinct result.

## Value Objects

- Extend `ValueObject<T>`.
- Use private constructors and static factories.
- Validate on creation.
- Compare by value through `equals`.
- Prefer `create()` for factories fed by external input; it returns `Result`
  when validation failure is an expected flow.
- Keep `of()` only as an internal throwing convenience when useful. Throw typed
  `DomainError` only for internal invariant breaches.

## Events

- Domain events are immutable versioned classes.
- Events include `eventId`, `occurredAt`, `eventType`, `version`,
  `aggregateId`, `aggregateType`, `context`, and scalar payload data.
- Event names are past tense.
- Event payloads must not contain entities, value objects, or ORM objects.

## Services, Mappers, And Presenters

- Domain services contain domain calculations that do not naturally belong on a
  single aggregate or value object.
- Application services orchestrate application concerns and depend on ports, not
  infrastructure implementations.
- Mappers convert between persistence records and domain objects.
- Presenters convert application/read models into transport response shapes.
