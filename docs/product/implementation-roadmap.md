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

Last updated 2026-10-11, after D2.

Built, on the earlier immutable model:

- **Simulations:** create, recalculate, list, view, duplicate, and delete.
  CDB, LCI, and LCA with prefixed, CDI, or effective SELIC remuneration on the
  252 business-day convention, with IOF, income tax, and the LCI/LCA exemption.
  A calculation is rejected when the chosen curve does not cover the
  period.
- **Results:** the summary, the tax explanation dialog, the balance evolution
  chart with monthly rows, and the calculation history.

Built for the target model:

- **Messaging:** runs locally end to end on EventBridge and SQS emulated by
  Floci (see "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md)). The outbox
  poller publishes to the `investflow` bus every second, backs a failed event
  off on its own (up to 5 minutes) and pauses during broker outages; events
  above the 200 KB outbox payload limit fail at save time. Consumers are plain
  classes that the host binds to their queues. No domain event is consumed
  yet.
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
  through the use case. The simulation workspace fills its terms from a
  visible offer grouped by title type and origin; no offer screens yet.

Differs from the target model:

- `Simulation` copies the offer terms; it does not reference the offer.
- Simulation calculations reference a curve directly; deleting one does not
  mark the simulations that use it.
- `SimulationCalculation` keeps every calculation instead of one current
  result, and calculation runs inside the request.

Not started and outside this roadmap: portfolios, simulation return rates and
remaining term, side-by-side comparison, IPCA calculation, and early
redemption.

## Next Steps

1. D3: simulations reference an offer and a curve and keep one result.
2. Decide how users enter a curve's intervals before D6 starts (open
   question in the curve specification).
3. Decide how D4b's batched fan-out writes calculation events before D4b
   starts (open decision in its section).

## Overview

| #   | Deliverable                                                       | Depends on                         | Status      |
| --- | ----------------------------------------------------------------- | ---------------------------------- | ----------- |
| D0  | Messaging runs locally end to end                                 | —                                  | Done        |
| D1  | Curves become independent, revisioned, and owned                  | D0                                 | Done        |
| D2  | Offers become independent, revisioned, and owned                  | D0                                 | Done        |
| D3  | Simulations reference an offer and curve; one result              | D1, D2                             | Not started |
| D4a | A simulation's own calculation runs asynchronously                | D3                                 | Not started |
| D4b | Offer and curve changes recalculate the simulations that use them | D4a                                | Not started |
| D4c | Reconciliation sweep, retries, and "Falha técnica"                | D4b                                | Not started |
| D5  | Offer screens (`/ofertas`)                                        | D2; best after D4b                 | Not started |
| D6  | Curve screens (`/curvas`)                                         | D1 and the interval-input decision | Not started |

```text
     ┌──► D1 ──┐
D0 ──┤         ├──► D3 ──► D4a ──► D4b ──► D4c
     └──► D2 ──┘                     │
          D2 ────────────────────────┴──► D5
          D1 ── (interval input decided) ──► D6
```

Recommended order: D0, D1, D2, D3, D4a, D4b, D4c, D5, D6. D0 went first
because it carried the most infrastructure unknowns and touched no business
code. D2 followed D1's single-aggregate model: offers are not grouped in the
domain (decision 2026-10-11). D6 waits for the pending product decision on how
users enter a curve's intervals, which can be made while D1 to D4 are
built.

Portfolios, simulation return rates, and remaining term are outside this
roadmap; they build on the new model once it is in place.

## D3 — Simulations always use an offer

- `Simulation` drops its copied terms and references an offer, an optional
  curve, and its investment. All are editable; the simulation has its own
  revision.
- "Digitar termos" and "Duplicar e ajustar" create a private offer in the
  same transaction as the simulation.
- `SimulationCalculation` and its history are replaced by one current result
  recording the simulation, offer, and curve revisions it used and the
  methodology version.
- Calculation stays synchronous in this deliverable, so the change is limited
  to the data model.
- Workspace: remove the history and the `calculo` URL parameter; add
  "Duplicar e ajustar" and "Digitar termos" to the offer picker; "Salvar e
  calcular" sends the revision.

**Done when** the workspace runs on the new model, and editing an offer or
curve is reflected the next time an affected simulation is saved.

## D4a — Asynchronous calculation of a simulation

- Calculation status (`PENDING` with `queuedAt`, `CALCULATING` with a lease,
  `CALCULATED`, `INVALID` with reason, `FAILED`).
- The request validates synchronously, persists the simulation as `PENDING`,
  and raises an event in the same transaction.
- The calculation consumer gets its queue through `consumer_queue` in
  `infra/floci/init/provision.sh`, and the API binds it with
  `SqsConsumersModule.register`.
- A consumer claims the calculation with a lease, calculates from current
  state, and writes the outcome only when its inputs are not older than the
  stored ones.
- Workspace: status in a live region, refetching while pending or
  calculating, and the last successful result marked as predating the
  changes.

**Done when** saving returns immediately, the result arrives asynchronously,
and duplicate or out-of-order deliveries cannot replace a newer result.

## D4b — Recalculation from premise changes

- Consumers for offer and curve changes mark the affected simulations
  `PENDING` and queue them in batches, never in one transaction.
- Deleting an offer or curve sets its simulations `INVALID` ("Sem oferta,
  escolha outra" or "Sem curva, escolha outra").
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
applies to the D4c sweep.

- **Outbox port (recommended for throughput).** An application port appends
  events to the outbox in the current transaction, implemented by
  `OutboxWriter`. Batch use cases pair it with a bulk update repository method.
  Aggregate changes keep using `save()`; the eventing skill must state when
  each path applies.
- **Load aggregates in small batches.** Keeps one path to the outbox at the
  cost of slower fan-out; affordable if calculation dominates the cost.

Rejected: bulk repository methods that write events themselves (event
definitions would live in a persistence adapter) and one summary event per
batch (complicates per-simulation claims, retries, and dead-lettering).

**Done when** editing a curve recalculates every simulation that uses it,
and deleting it moves them to "Requer ação".

## D4c — Recovery

- A periodic sweep queues a simulation again when it is `PENDING` with an old
  `queuedAt`, `CALCULATING` with an expired lease, `CALCULATED` or `INVALID`
  with stored inputs or methodology version different from the target, or
  `FAILED` past a cooldown.
- "Tentar novamente" for `FAILED` simulations.

**Done when** a dropped calculation message, a dropped fan-out event, a worker
killed mid-calculation, and a methodology version change all converge to
`CALCULATED` or `INVALID`.

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
