# Deployment And Composition

## Applications And Bounded Contexts

- Treat projects under `apps/` as deployable runtime hosts and composition
  roots. Apps own bootstrap, process lifecycle, global transport configuration,
  and the selection of bounded contexts and adapters included in a deployment.
- Treat each top-level `libs/<context>/` feature grouping as one bounded
  context. Its `domain`, `application`, and `infrastructure` directories are Nx
  layer projects, not separate bounded contexts.
- Keep apps thin. An app imports public bounded-context infrastructure modules;
  it does not re-register every context-local controller, handler, repository,
  or mapper.
- `libs/shared` contains cross-context building blocks and is not a bounded
  context.

## Runtime Portability

- Domain projects are framework-free. They must not import NestJS, Prisma, AWS
  SDKs, transport types, environment configuration, or process lifecycle APIs.
- Application and infrastructure projects may use NestJS. They must not assume
  whether they run in a long-lived server, Lambda, queue worker, or another
  deployment host.
- Keep EC2, Lambda, API Gateway, and worker entrypoints under `apps/`. The host
  decides which HTTP adapters, consumers, persistence adapters, schedulers, and
  background publishers are active.
- A single context infrastructure module is acceptable while all hosts need the
  same adapters. When host profiles diverge, expose independently composable
  modules such as HTTP, messaging, persistence, and background-publishing
  modules instead of activating them as import side effects.

## Deployment Evolution

- `apps/api` composes every active bounded context into the current modular
  monolith.
- A future service or Lambda app composes only its owned context and the
  adapters required by that host. Moving a context to another process must not
  require moving its business code out of `libs/`.
- Preserve extraction boundaries now: contexts do not import one another's
  internals, do not query one another's tables, and do not require
  cross-context database transactions.
- Use explicit integration events or versioned transport contracts across
  contexts. Do not expose internal aggregates or domain events as shared wire
  contracts.
