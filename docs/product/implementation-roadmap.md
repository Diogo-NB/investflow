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

Last updated 2026-10-12, after D4a.

Built for the target model:

- **Messaging:** runs locally end to end on EventBridge and SQS emulated by
  Floci (see "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md)). The outbox
  poller publishes to the `investflow` bus every second, backs a failed event
  off on its own (up to 5 minutes) and pauses during broker outages; events
  above the 200 KB outbox payload limit fail at save time. Consumers are plain
  classes that the host binds to their queues; the API binds the simulation
  calculation consumer and its dead-letter consumer.
- **Curves:** independent, revisioned `Curve` aggregates with owners; `null`
  is the system. Alternatives of an index ("CDI base", "CDI otimista") are
  separate curves, and screens group them by index and origin; no grouping
  is stored. The API under `investment-simulator/curves` lists, reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  curves, always as the authenticated user. Every change writes an
  identifier-only event to the outbox. The seed creates the system curves
  through the same use case with the system actor. The simulation workspace
  picks a curve grouped by origin; no curve screens yet.
- **Offers:** independent, revisioned `Offer` aggregates on the same model as
  curves: title type (fixed), name, optional issuer, remuneration and rate,
  maturity, and liquidity, with an owner (`null` is the system). Variants from
  one issuer are separate offers, and screens group them by title type and
  origin; no grouping is stored. The API under `investment-simulator/offers`
  lists (paginated, `q` matching name or issuer, `titleType`), reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  offers as the authenticated user, and every change writes an
  identifier-only event to the outbox. The seed creates the system offers
  through the use case. No offer screens yet.
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

Differs from the target model:

- Editing or deleting an offer or curve does not queue the simulations that
  use it; they are flagged "Desatualizado" until saved again (D4b).
- The worker's guard covers only the simulation revision: an outcome
  calculated from an older offer or curve revision can land after a newer
  one, and is then shown as "Desatualizado" (D4b adds those revisions).

Not started and outside this roadmap: portfolios, simulation return rates and
remaining term, side-by-side comparison, IPCA calculation, and early
redemption.

## Next Steps

1. Decide how D4b's batched fan-out writes calculation events (open decision
   in its section), then build D4b.
2. Decide how users enter a curve's intervals before D6 starts (open
   question in the curve specification).

## Overview

| #   | Deliverable                                                       | Depends on                         | Status      |
| --- | ----------------------------------------------------------------- | ---------------------------------- | ----------- |
| D0  | Messaging runs locally end to end                                 | —                                  | Done        |
| D1  | Curves become independent, revisioned, and owned                  | D0                                 | Done        |
| D2  | Offers become independent, revisioned, and owned                  | D0                                 | Done        |
| D3  | Simulations reference an offer and curve; one result              | D1, D2                             | Done        |
| D4a | A simulation's own calculation runs asynchronously                | D3                                 | Done        |
| D4b | Offer and curve changes recalculate the simulations that use them | D4a                                | Not started |
| D5  | Offer screens (`/ofertas`)                                        | D2; best after D4b                 | Not started |
| D6  | Curve screens (`/curvas`)                                         | D1 and the interval-input decision | Not started |

```text
     ┌──► D1 ──┐
D0 ──┤         ├──► D3 ──► D4a ──► D4b
     └──► D2 ──┘                     │
          D2 ────────────────────────┴──► D5
          D1 ── (interval input decided) ──► D6
```

Recommended order: D0, D1, D2, D3, D4a, D4b, D5, D6. D0 went first
because it carried the most infrastructure unknowns and touched no business
code. D2 followed D1's single-aggregate model: offers are not grouped in the
domain (decision 2026-10-11). D6 waits for the pending product decision on how
users enter a curve's intervals, which can be made while D1 to D4 are
built.

D4c (a periodic reconciliation sweep) was dropped on 2026-10-12. The outbox
writes every event with its change, and SQS redelivers a message until it is
handled or dead-lettered, so no message is lost and no claim can expire.
"Falha técnica" and "Tentar novamente" moved to D4a, and requeuing after a
methodology version change moved to D4b.

Portfolios, simulation return rates, and remaining term are outside this
roadmap; they build on the new model once it is in place.

## D4b — Recalculation from premise changes

The flow is in walkthroughs 5 and 6 of
[Event Flow](../architecture/event-flow.md).

- Offer and curve events carry the actor id, so fan-out can record who
  caused a recalculation.
- Consumers for offer and curve changes page through the affected
  simulations by id, never in one transaction. Each page updates only
  `simulation_calculation` to `PENDING` with the cause (`OFFER_CHANGED` or
  `CURVE_CHANGED`, the id, the actor) and writes one
  `SimulationCalculationRequested` per simulation.
- Deleting an offer or curve sets its simulations `INVALID` in pages, with no
  calculation ("Sem oferta, escolha outra" or "Sem curva, escolha outra").
- The worker's conditional save also requires the offer and curve revisions
  it read, now that every premise change queues its own messages.
- Changing a title type's methodology version queues its simulations through
  the same batched path, run once with the deploy that changes it.
- A query counting the user's affected simulations, for impact notices.
- Outbox publishing throughput. The poller publishes one event per
  EventBridge call, sequentially, so it sustains roughly 20 to 50 events per
  second, and after a full batch it waits for the next tick. A system curve
  edit can queue thousands of calculations. Batch entries per `PutEvents` call
  (up to 10, checking each entry's result), mark a batch with one update, and
  poll again immediately when a batch was full.

**Open decision, settle before starting:** how batched fan-out writes its
calculation events. Events are written to the outbox only by
`BaseRepository.save()`, so only a loaded aggregate can raise them, but fan-out
is meant to update simulations in bulk without loading them. The same choice
applies to the methodology requeue.

- **Outbox port (recommended for throughput).** An application port appends
  events to the outbox in the current transaction, implemented by
  `OutboxWriter`. Batch use cases pair it with a bulk update repository method.
  Aggregate changes keep using `save()`; the eventing skill must state when
  each path applies.
- **Load aggregates in small batches.** Keeps one path to the outbox at the
  cost of slower fan-out; affordable if calculation dominates the cost.

Rejected: bulk repository methods that write events themselves (event
definitions would live in a persistence adapter) and one summary event per
batch (complicates per-simulation retries and dead-lettering).

**Done when** editing a curve recalculates every simulation that uses it,
deleting it moves them to "Requer ação", and a methodology version change
recalculates the simulations of its title type.

## D5 — Offer screens

Implement "Offer behavior" in the frontend guide under `/ofertas`: grouped
list, details, editor with impact notice and revision conflicts,
duplicate, and delete. Best after D4b so impact notices have real counts.

**Done when** the recorded offer behavior works against the API and the
frontend verification in the guide passes.

## D6 — Curve screens

Implement "Curve behavior" in the frontend guide under `/curvas`. Blocked on
the product decision about the interval input; everything else it needs exists
after D1.

**Done when** the recorded curve behavior works against the API and the
frontend verification in the guide passes.
