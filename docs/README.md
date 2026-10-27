# Docs

Read the file a change needs, not the whole folder. Each file owns its topic;
other files link to it instead of repeating it.

## Product

- [implementation-roadmap.md](product/implementation-roadmap.md): next steps, open deliverables (D-numbered), their decisions and status. Read when: planning or starting a deliverable.
- [current-state.md](product/current-state.md): what is built, per area, and where it differs from the target model. Read when: checking whether something exists before planning or building on it.
- [investment-simulator-prd.md](product/investment-simulator-prd.md): business rules, calculations, taxes, access (pt-BR). Read when: a change touches a business rule or calculation.
- [index-value-curves.md](product/index-value-curves.md): curve rules: intervals, conventions, coverage, observed curves (pt-BR). Read when: a change touches curves or index values.
- [screens/app-shell.md](product/screens/app-shell.md): login, session, logout, shell behavior. Read when: changing the shell or authentication in the browser.
- [screens/simulations.md](product/screens/simulations.md): simulation list, workspace, and comparison behavior. Read when: changing a `/simulacoes` screen.
- [screens/offers.md](product/screens/offers.md): offer screens behavior. Read when: changing an `/ofertas` screen.
- [screens/curves.md](product/screens/curves.md): curve screens behavior. Read when: changing a `/curvas` screen.
- [screens/investment-plans.md](product/screens/investment-plans.md): investment plan screens behavior. Read when: changing a `/planos` screen.

## Architecture

- [project-structure.md](architecture/project-structure.md): apps and libraries, runtime portability, layers, folder taxonomy, file naming, imports. Read when: adding a project, file, or folder, or changing composition.
- [queries.md](architecture/queries.md): query output contracts and screen-oriented queries (BFF). Read when: adding or changing a query handler or the data a screen reads.
- [recalculation.md](architecture/recalculation.md): mutable offers and curves, revisions, asynchronous calculation and recalculation. Read when: changing offers, curves, simulations, or their calculation.
- [messaging.md](architecture/messaging.md): outbox, relay, poller, EventBridge, SQS FIFO, consumers, hosts. Read when: changing how events are recorded, published, routed, or consumed.
- [event-flow.md](architecture/event-flow.md): visual walkthrough of events and recalculation; the Event Catalog. Read when: adding or changing an event, or learning the flow.
- [frontend-patterns.md](architecture/frontend-patterns.md): frontend decisions, pinned stack, app structure, composition contract, configuration, browser verification, the business calendar. Read when: adding a dependency, project, route export, or form business rule, or before browser checks.
- [deferred-work.md](architecture/deferred-work.md): consciously postponed work, with why and when to revisit. Read when: before touching an area it names; when postponing something.

[`DESIGN.md`](../DESIGN.md) at the root owns the visual design tokens.
