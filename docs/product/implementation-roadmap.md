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

Last updated 2026-10-11, after D0.

Built, on the earlier immutable model:

- **Simulations:** create, recalculate, list, view, duplicate, and delete.
  CDB, LCI, and LCA with prefixed, CDI, or effective SELIC remuneration on the
  252 business-day convention, with IOF, income tax, and the LCI/LCA exemption.
  A calculation is rejected when the curve does not cover the period.
- **Results:** the summary, the tax explanation dialog, the balance evolution
  chart with monthly rows, and the calculation history.
- **Offers:** backend CRUD only; no browser screens.
- **Index curves:** domain, persistence, and the reads used by the simulation
  workspace; curves are created only by the seed.

Built for the target model:

- **Messaging:** runs locally end to end on EventBridge and SQS emulated by
  Floci (see "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md)). The outbox
  poller publishes to the `investflow` bus every second, backs a failed event
  off on its own (up to 5 minutes) and pauses during broker outages; events
  above the 200 KB outbox payload limit fail at save time. Consumers are plain
  classes that the host binds to their queues. No domain event is emitted or
  consumed yet.

Differs from the target model:

- `Simulation` copies the offer terms; it does not reference a condition.
- `IndexCurve` is immutable and has no scenarios; offers have no groups.
- Offers and curves have no owner and no revision.
- `SimulationCalculation` keeps every calculation instead of one current
  result, and calculation runs inside the request.

Not started and outside this roadmap: portfolios, simulation return rates and
remaining term, side-by-side comparison, IPCA calculation, and early
redemption.

## Next Steps

1. D1 and D2, in either order or in parallel. They are the first deliverables
   to emit events.
2. Decide how users enter a scenario's intervals before D6 starts (open
   question in the curve specification).
3. Decide how D4b's batched fan-out writes calculation events before D4b
   starts (open decision in its section).

## Overview

| #   | Deliverable                                                       | Depends on                         | Status      |
| --- | ----------------------------------------------------------------- | ---------------------------------- | ----------- |
| D0  | Messaging runs locally end to end                                 | —                                  | Done        |
| D1  | Curves become groups of revisioned scenarios with owners          | D0                                 | Not started |
| D2  | Offers become groups of revisioned conditions with owners         | D0                                 | Not started |
| D3  | Simulations reference a condition and scenario; one result        | D1, D2                             | Not started |
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
because it carried the most infrastructure unknowns, touched no business code,
and D1 and D2 are the first deliverables to emit events. D1 and D2 are
independent of each other. D6 waits for the pending product decision on how
users enter a scenario's intervals, which can be made while D1 to D4 are
built.

Portfolios, simulation return rates, and remaining term are outside this
roadmap; they build on the new model once it is in place.

## D1 — Curve groups and scenarios

- Split `IndexCurve` into a `Curve` group aggregate (index, name, owner) and a
  `CurveScenario` aggregate (name, description, intervals, owner, revision).
  Interval and coverage behavior moves to the scenario unchanged.
- Ownership from the Keycloak `sub`; `null` owner means system. Visibility is
  own plus system content, decided per scenario.
- Use cases: create a curve with its first scenario, edit a scenario (revision
  check, conflict on mismatch), duplicate a scenario (private copy in the same
  curve), delete a scenario, rename and delete a private curve. Deleting the
  last scenario of a private curve deletes the curve; a system process
  deleting a system curve that holds private scenarios retires it instead.
- Domain events with the revision and changed fields, persisted to the outbox
  (no consumers yet).
- The seed creates the system curves.
- HTTP endpoints for the use cases and the curve and scenario reads.
- The simulation options query returns scenarios grouped by curve; the
  existing scenario picker adapts.

**Done when** the curve API enforces ownership and revisions, and the current
simulation workspace still calculates with a scenario.

## D2 — Offer groups and conditions

- `Offer` group aggregate (title type, issuer, name, owner) and
  `OfferCondition` aggregate (remuneration and rate, maturity, liquidity,
  optional name, owner, revision).
- Same visibility rules, use cases, events, conflict checks, and seed as D1.
- The simulation workspace fills terms from a condition.

**Done when** the offer API enforces ownership and revisions, and the current
workspace can still fill its terms from a condition.

## D3 — Simulations always use an offer

- `Simulation` drops its copied terms and references a condition, an optional
  scenario, and its investment. All are editable; the simulation has its own
  revision.
- "Digitar termos" and "Duplicar e ajustar" create a private offer or
  condition in the same transaction as the simulation.
- `SimulationCalculation` and its history are replaced by one current result
  recording the simulation, condition, and scenario revisions it used and the
  methodology version.
- Calculation stays synchronous in this deliverable, so the change is limited
  to the data model.
- Workspace: remove the history and the `calculo` URL parameter; add the
  condition picker grouped by offer with "Duplicar e ajustar" and "Digitar
  termos"; "Salvar e calcular" sends the revision.

**Done when** the workspace runs on the new model, and editing a condition or
scenario is reflected the next time an affected simulation is saved.

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

- Consumers for condition and scenario changes mark the affected simulations
  `PENDING` and queue them in batches, never in one transaction.
- Deleting a condition or scenario sets its simulations `INVALID` ("Sem oferta,
  escolha outra" or "Sem curva, escolha outra").
- A query counting the user's affected simulations, for impact notices.
- Outbox publishing throughput. The poller publishes one event per
  EventBridge call, sequentially, so it sustains roughly 20 to 50 events per
  second, and after a full batch it waits for the next tick. A system scenario
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

**Done when** editing a scenario recalculates every simulation that uses it,
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
list, details, condition editor with impact notice and revision conflicts,
duplicate, and delete. Best after D4b so impact notices have real counts.

**Done when** the recorded offer behavior works against the API and the
frontend verification in the guide passes.

## D6 — Curve screens

Implement "Curve behavior" in the frontend guide under `/curvas`. Blocked on
the product decision about the interval input; everything else it needs exists
after D1.

**Done when** the recorded curve behavior works against the API and the
frontend verification in the guide passes.
