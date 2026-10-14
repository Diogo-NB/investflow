# Implementation Roadmap

Delivery plan for the redesign decided on 2026-10-11: mutable premises and
asynchronous recalculation. Product rules are in the
[PRD](./investment-simulator-prd.md) and the
[curve specification](./index-value-curves.md); the architecture is in
"Mutable Premises And Asynchronous Recalculation" in
[Project Structure](../architecture/project-structure.md); screen behavior is
in [Frontend Patterns](../architecture/frontend-patterns.md).

Each deliverable is one pull request. Every pull request keeps `pnpm check`
green and the app working end to end: a backend change also adapts the screens
that consume it, so `main` is never half migrated. The local database is
disposable, so schema changes reset it with `pnpm db:setup` instead of
migrating existing rows.

> **Keep this document current.** Update it in the same pull request that
> changes what it describes: the current state, the next steps, a
> deliverable's status, scope or done criteria, and any decision that reorders
> the plan. Remove a deliverable's detail section once it ships and its
> outcome is reflected in the current state.

## Current State

Last updated 2026-10-13, after D6. D4b is paused after its first step.

Built for the target model:

- **Messaging:** runs locally end to end on EventBridge and SQS emulated by
  Floci (see "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md)). The outbox
  poller publishes to the `investflow` bus every second, backs a failed event
  off on its own (up to 5 minutes) and pauses during broker outages; events
  above the 200 KB outbox payload limit fail at save time. Consumers are plain
  classes that the host binds to their queues; the API binds the simulation
  calculation consumer and its dead-letter consumer. Events are recorded in
  the unit of work (`UnitOfWork.run()`) that every request, consumer, and the
  seed runs in: aggregates through their repository's `save()`, services
  through the `DomainEventRecorder` port. The unit of work writes them to the
  outbox before commit, in chunks of 1,000 rows.
- **Curves:** independent, revisioned `Curve` aggregates with owners; `null`
  is the system. Alternatives of an index ("CDI base", "CDI otimista") are
  separate curves, and screens group them by index and origin; no grouping
  is stored. The API under `investment-simulator/curves` lists, reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  curves, always as the authenticated user. Every change writes an
  identifier-only event to the outbox. The seed creates the system curves
  through the same use case with the system actor. The simulation workspace
  picks a curve grouped by origin. A curve has no missing business days (or
  months, for IPCA) between its first and last intervals; the domain rejects
  a gap with `CURVE_INTERVAL_GAP`. The `/curvas` screens list (filtered by
  index, with coverage), show (with a chart), create (optionally copying a
  base curve's intervals), edit, duplicate, and delete curves (D6); intervals
  are typed in a row table kept contiguous, with business-day pickers and
  months for IPCA, and a curve's page lists the user's simulations that use
  it. A simulation missing curve values links to its curve.
- **Offers:** independent, revisioned `Offer` aggregates on the same model as
  curves: title type (fixed), name, optional issuer, remuneration and rate,
  maturity, and liquidity, with an owner (`null` is the system). Variants from
  one issuer are separate offers, and screens group them by title type and
  origin; no grouping is stored. The API under `investment-simulator/offers`
  lists (paginated, `q` matching name or issuer, `titleType`, `origin`),
  reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  offers as the authenticated user, and every change writes an
  identifier-only event to the outbox. The seed creates the system offers
  through the use case. The `/ofertas` screens list, search, show, create,
  edit, duplicate, and delete offers (D5); an offer's page lists the user's
  simulations that use it, and its delete dialog and editor state how many.
- **Simulations:** reference a visible offer and, for indexed remuneration, a
  curve of its index, plus the principal and investment date; all are
  editable and the simulation has its own revision (`PATCH` with the revision,
  `409` on mismatch). "Digitar termos" and "Duplicar e ajustar" send the terms
  of a new private offer, created in the same transaction as the simulation.
  CDB, LCI, and LCA with prefixed, CDI, or effective SELIC remuneration on the
  252 business-day convention, with IOF, income tax, and the LCI/LCA
  exemption.
- **Asynchronous calculation (D4a):** saving validates every rule except
  curve coverage on the request's fields, stores the calculation `PENDING`
  with its cause in `simulation_calculation`, and raises `SimulationCreated`
  or `SimulationEdited`; `PATCH` answers the new revision. The
  `simulation-calculations` consumer calculates through
  `SimulationCalculationService` and records `CALCULATED` or `INVALID` (an
  uncovered period, a deleted offer or curve) with a write conditional on the
  simulation revision, discarding stale outcomes. Its dead-letter consumer
  records `FAILED` over a calculation still `PENDING`, and
  `POST simulations/:id/recalculate` ("Tentar novamente") queues it again
  with `SimulationCalculationRequested`. The consumer handles all three
  events.
- **Results:** one current result per simulation, recording the simulation,
  offer, and curve revisions and the methodology version it used. Reads flag
  it "Desatualizado" when any of them changed, including a deleted offer or
  curve; saving queues a calculation from the current premises. The workspace
  polls every 3 seconds and shows the status and its cause ("Calculando",
  "Atualizado", "Requer ação" with the reason, "Falha técnica" with "Tentar
  novamente") over the last result, the summary, the tax explanation dialog,
  and the balance evolution chart with monthly rows; the list tags rows that
  are not up to date.
- **Simulation list filters:** `GET simulations` filters the owner's
  simulations by `offerId`, `curveId`, `titleType`, `remunerationKind`, and
  `calculationStatus`, combined with AND; there is no index filter because
  the remuneration kind fixes the index. `/simulacoes` filters with the same
  URL parameters, carried to a simulation and back, and the offer screens
  count affected simulations from the `offerId` filter's total.

Differs from the target model:

- Editing or deleting an offer or curve does not queue the simulations that
  use it; they are flagged "Desatualizado" until saved again (D4b, paused).
  The offer and curve screens say so in their impact notices.
- The worker's guard covers only the simulation revision: an outcome
  calculated from an older offer or curve revision can land after a newer
  one, and is then shown as "Desatualizado" (D4b adds those revisions).

Not started and outside this roadmap: portfolios, simulation return rates and
remaining term, side-by-side comparison, IPCA calculation, and early
redemption.

## Next Steps

1. Resume D4b: actor on events, page fan-out, worker guard, and publishing
   throughput.

## Overview

| #   | Deliverable                                                       | Depends on                         | Status |
| --- | ----------------------------------------------------------------- | ---------------------------------- | ------ |
| D0  | Messaging runs locally end to end                                 | —                                  | Done   |
| D1  | Curves become independent, revisioned, and owned                  | D0                                 | Done   |
| D2  | Offers become independent, revisioned, and owned                  | D0                                 | Done   |
| D3  | Simulations reference an offer and curve; one result              | D1, D2                             | Done   |
| D4a | A simulation's own calculation runs asynchronously                | D3                                 | Done   |
| D4b | Offer and curve changes recalculate the simulations that use them | D4a                                | Paused |
| D5  | Offer screens (`/ofertas`)                                        | D2                                 | Done   |
| D6  | Curve screens (`/curvas`)                                         | D1 and the interval-input decision | Done   |

```text
     ┌──► D1 ──┐
D0 ──┤         ├──► D3 ──► D4a ──► D4b
     └──► D2 ──┘
          D2 ──► D5
          D1 ── (interval input decided) ──► D6
```

Recommended order: D0, D1, D2, D3, D4a, D5, D6, D4b. D0 went first
because it carried the most infrastructure unknowns and touched no business
code. D2 followed D1's single-aggregate model: offers are not grouped in the
domain (decision 2026-10-11). D6 waited for the product decision on how users
enter a curve's intervals: an editable row table, IPCA as months, and no
observed or projected mark yet (decision 2026-10-13). It then went before
D4b, like D5.

D4b was paused on 2026-10-13 after its first step, and D5 went before it. Its
impact counts became the filtered simulation list, which D5 built: the
`offerId` filter's total says how many simulations a change affects, and D6
uses the `curveId` filter the same way. Until D4b resumes, the offer and curve
screens say that affected simulations stay
"Desatualizado" until saved again.

D4c (a periodic reconciliation sweep) was dropped on 2026-10-12. The outbox
writes every event with its change, and SQS redelivers a message until it is
handled or dead-lettered, so no message is lost and no claim can expire.
"Falha técnica" and "Tentar novamente" moved to D4a. Requeuing after a
methodology version change moved to D4b and was then deferred (2026-10-12,
see "Deferred Work" in [Project Structure](../architecture/project-structure.md)).

Portfolios, simulation return rates, and remaining term are outside this
roadmap; they build on the new model once it is in place.

## D4b — Recalculation from premise changes

**Paused (2026-10-13).** Step 1 is done; the remaining points below are
settled but not built. Impact counts moved into D5 as the filtered simulation
list. When D4b resumes, replace the offer and curve screens' interim copy
("ficarão desatualizadas até serem salvas novamente") with the recalculation
notice.

The flow is in walkthroughs 5 and 6 of
[Event Flow](../architecture/event-flow.md). Decisions settled on 2026-10-12:

- **Done (step 1): events are recorded in the unit of work, not by the
  repository.**
  - The `DomainEventRecorder` port (shared-domain) lets domain services,
    application services, and repositories record events.
  - `UnitOfWork.run()` buffers them and writes them to `outbox_events` in
    chunks of 1,000 rows right before commit. Recording outside a unit of work
    throws.
  - This resolved the earlier open decision on how fan-out writes events
    without loading aggregates: there is no separate outbox port.
- **Actor on events:** offer and curve events carry the actor id, so fan-out
  can record who caused a recalculation.
- **Page fan-out:** a consumer for `OfferChanged`, `OfferDeleted`,
  `CurveChanged`, and `CurveDeleted` processes one page of about 500
  simulation ids (ordered by id after a cursor) per message. Each page:
  - bulk-updates their `simulation_calculation` rows to `PENDING` with the
    cause (kind, offer or curve id, actor), without loading aggregates or
    touching `simulation`;
  - records one `SimulationCalculationRequested` per simulation;
  - when full, records a continuation event
    (`{ premise, premiseId, causeKind, actorId, afterSimulationId }`) handled
    by the same consumer.

  Each page is its own transaction, retried and dead-lettered on its own.

- **Deletion requeues like a change**, with `OFFER_DELETED` or
  `CURVE_DELETED`. The worker finds the premise missing and records `INVALID`
  ("Sem oferta, escolha outra" / "Sem curva, escolha outra"). Fan-out never
  writes `INVALID`: a race with a user switching premises would strand a valid
  simulation in a terminal state, while a wrong `PENDING` self-corrects.
- **Worker guard:** the worker's conditional save also requires the offer and
  curve revisions it read. An outcome calculated before a premise edit or
  delete is discarded, since fan-out queued a newer calculation.
- **Publishing throughput:** the poller publishes one event per EventBridge
  call, sequentially, roughly 20 to 50 events per second, and after a full
  batch it waits for the next tick. A system curve edit can queue thousands of
  calculations. Instead, send up to 10 entries per `PutEvents` (checking each
  entry's result), mark a batch with one update, and poll again immediately
  when a batch was full.
- **Outbox ordering stays by `created_at`:** rows recorded in one transaction
  publish in no particular order. Add a position column only when a consumer
  needs order.
- **Methodology requeue: deferred.** See "Deferred Work" in
  [Project Structure](../architecture/project-structure.md).

**Done when** editing a curve recalculates every simulation that uses it, and
deleting it moves them to "Requer ação".
