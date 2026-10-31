# Docs

Read the file a change needs, not the whole folder. Each file owns its topic;
other files link to it instead of repeating it.

## Product

Product docs are in pt-BR and in product language: general terms such as DDD, event, or database are fine; implementation terms (use case, consumer, port, transaction, library names) belong in Architecture or Implementation.

- [investment-simulator-prd.md](product/investment-simulator-prd.md): business rules, calculations, taxes, access. Read when: a change touches a business rule or calculation.
- [index-value-curves.md](product/index-value-curves.md): curve rules: intervals, conventions, coverage, BCB curves. Read when: a change touches curves or index values.
- [screens/app-shell.md](product/screens/app-shell.md): login, session, logout, shell behavior. Read when: changing the shell or authentication in the browser.
- [screens/simulations.md](product/screens/simulations.md): simulation list, workspace, and comparison behavior. Read when: changing a `/simulacoes` screen.
- [screens/offers.md](product/screens/offers.md): offer screens behavior. Read when: changing an `/ofertas` screen.
- [screens/curves.md](product/screens/curves.md): curve screens behavior. Read when: changing a `/curvas` screen.
- [screens/investment-plans.md](product/screens/investment-plans.md): investment plan screens behavior. Read when: changing a `/planos` screen.

## Implementation

What is built and what is pending, in English.

- [current-state.md](implementation/current-state.md): what is built, per area, and where it differs from the target model. Read when: checking whether something exists before planning or building on it.
- [planned/](implementation/planned/): one file per pending feature or postponed work, with its open decisions, scope, and done criteria; deleted once it ships. Today: [bcb-rate-import.md](implementation/planned/bcb-rate-import.md), [fan-out-at-scale.md](implementation/planned/fan-out-at-scale.md), [api-mcp-server.md](implementation/planned/api-mcp-server.md), [production-hardening.md](implementation/planned/production-hardening.md). Read when: planning or starting that feature, or touching an area it names.

## Architecture

- [project-structure.md](architecture/project-structure.md): apps and libraries, runtime portability, layers, folder taxonomy, file naming, imports. Read when: adding a project, file, or folder, or changing composition.
- [queries.md](architecture/queries.md): query output contracts and screen-oriented queries (BFF). Read when: adding or changing a query handler or the data a screen reads.
- [recalculation.md](architecture/recalculation.md): mutable offers and curves, revisions, asynchronous calculation and recalculation. Read when: changing offers, curves, simulations, or their calculation.
- [messaging.md](architecture/messaging.md): outbox, relay, poller, EventBridge, SQS FIFO, consumers, hosts. Read when: changing how events are recorded, published, routed, or consumed.
- [event-flow.md](architecture/event-flow.md): visual walkthrough of events and recalculation; the Event Catalog. Read when: adding or changing an event, or learning the flow.
- [deployment.md](architecture/deployment.md): production on the shared VPS: the compose service, images, releases and rollbacks, AWS credentials. Read when: changing the Dockerfiles, `infra/dokploy`, `infra/aws`, or the release workflows. Procedures are in the [runbook](../infra/dokploy/README.md).
- [frontend-patterns.md](architecture/frontend-patterns.md): frontend decisions, pinned stack, app structure, composition contract, configuration, browser verification, the business calendar. Read when: adding a dependency, project, route export, or form business rule, or before browser checks.

[`DESIGN.md`](../DESIGN.md) at the root owns the visual design tokens.
