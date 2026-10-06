# Investment Simulator Bounded Context

`investment-simulator` is one bounded context composed from four Nx library
projects:

- `domain` owns investment simulation rules, aggregates, value objects, and
  domain services. It is framework-free.
- `application` orchestrates use cases and defines ports. It may use NestJS but
  does not select a deployment host.
- `infrastructure` exposes Nest controllers and query handlers and implements
  persistence and integration adapters.
- `web` owns lazy Angular offer routes, state, forms, and browser API clients.
  It exports route composition only and never imports backend projects.

The libraries are not independently deployed. `apps/api` currently imports the
public infrastructure module and deploys this context with every other active
context as one modular monolith. A future service or Lambda app can import this
same context and select only the adapters required by that host.

Dependencies point inward: infrastructure depends on application and domain;
application depends on domain; domain depends only on framework-free shared
domain building blocks. Other bounded contexts communicate with this context
through explicit integration events or versioned transport contracts, never by
importing its internal layers.

See [`docs/architecture/project-structure.md`](../../docs/architecture/project-structure.md)
for workspace-wide composition and coding rules.
