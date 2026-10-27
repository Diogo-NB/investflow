# Deferred Work

Work that was consciously postponed but must still be implemented. Each item
says why it was deferred, what exists today, and what "done" means. Remove an
item when it ships.

## HTTP caching of the business calendar (deferred 2026-10-10)

`GET /investment-simulator/business-calendar?fromYear=&toYear=` returns the
weekday holidays of the requested years (about 2,000 dates for the 201 years
the page asks for).

- **Today:** the API keeps its last answer in memory, so the range every
  browser asks for is computed once per process until the year changes; the browser reads it once per session. The
  response sends no cache headers, so every new session repeats the request.
- **Why deferred:** one small request per session is cheap, and correctness
  came first.
- **Done means:**
  - Responses carry HTTP caching headers. They are bearer-authenticated, so
    use `Cache-Control: private` with a `max-age` ending at the next year
    change plus an `ETag`, so browsers revalidate cheaply.
  - The `ETag` includes a version of the calendar rules. A change to the
    holiday rules (a new national holiday, an ANBIMA calendar change) must
    invalidate cached responses instead of serving stale dates.
  - Tests cover the headers and invalidation on a rules version change.

## Durable audit of premise changes (deferred 2026-10-11)

The product records the revision and what changed for every change to an
offer or curve.

- **Today:** nothing records it. Domain events carry identifiers only (see
  Mutable Premises And Asynchronous Recalculation), so the audit cannot be
  derived from them, and the outbox is a delivery mechanism whose rows may be
  cleaned up.
- **Why deferred:** audit is a low-priority requirement. Aggregates already
  keep their revision, and use cases already know the actor and the change,
  so recording it later needs no aggregate change.
- **Done means:**
  - Each change is kept in a durable audit store (an `audit_entry` row written
    in the same transaction as the change), with the aggregate, revision,
    actor (user or system), instant, and changed fields' previous and new
    values.
  - Outbox cleanup cannot remove audit history.
  - Users can read the history of the offers and curves they can see.
  - Tests cover recording, ordering by revision, and visibility.

## Calculation status history (deferred 2026-10-12)

A simulation's calculation states over time (status, cause, actor, reason, and
instant), for support and for explaining past recalculations.

- **Today:** `simulation_calculation` keeps only the current state, with its
  cause, reason, and `changedAt` (see Recalculation). The PRD excludes
  calculation history and audit from the MVP.
- **Why deferred:** the current state with its cause answers what the screen
  needs. A history grows with every premise change across all users (a
  system curve edit writes at least two transitions per affected
  simulation), so it needs a retention rule and a product decision.
- **Done means:**
  - A product decision records what the history is for and who reads it.
  - Every write to `simulation_calculation`, including fan-out pages, also
    inserts the same described row into `simulation_calculation_transition`
    in the same transaction; the aggregate does not change.
  - A retention rule bounds its size, for example the last N transitions per
    simulation.
  - Tests cover recording from each write path and retention.

## Fan-out at scale (deferred 2026-10-26)

- **Today:** fan-out records every
  `SimulationCalculationRequested` for a premise in one unit of work. A
  system curve used by hundreds of thousands of simulations would need one
  very large transaction, which could outlast the 30-second visibility
  timeout and be dead-lettered. Publishing is batched (about 2,700 events
  per second per instance at a 30 ms round trip, bounded by the `PutEvents`
  quota), but the relay takes at most 5,000 rows of a burst; the poller
  publishes the rest after the grace period, 100 rows per claim.
- **Revisit with:** recording through the outbox in bounded chunks (a
  dispatcher mode whose handler opens its own units of work, ids streamed
  from the repository, a visibility heartbeat), and listeners that handle
  different message groups concurrently.
- **Done when** a premise reaching any number of simulations fans out in
  bounded transactions within the visibility timeout, and publishing keeps
  up.

## Recalculation status on screen (deferred 2026-10-26)

- **Today:** fan-out writes no calculation rows, so a
  simulation waiting for the recalculation of a premise change shows the
  derived "Desatualizado" until its new result lands, never "Calculando".
  For the same reason a fan-out calculation that exhausts its retries is
  not recorded `FAILED` (the dead-letter consumer writes `FAILED` only over
  `PENDING`): the simulation stays "Desatualizado", never "Falha técnica".
- **Revisit with:** a derived "Recalculando" status (the result's term or
  value revisions differ from the current ones, so a recalculation is on its
  way), with the cause from the input that differs and the actor from the
  premise's owner, in the workspace, the list (including its
  `calculationStatus` filter), the comparison, and the investment plans'
  status (which counts those members as outdated today and so does not poll
  for them).
- **Done when** the screens say a simulation is being recalculated because
  its offer or curve changed, and say when that recalculation failed.

## Requeue after a methodology version change (deferred 2026-10-12)

- **Why deferred:** no methodology version has changed yet, and the trigger
  (automatic at startup or a deploy-time command) is a separate decision from
  premise fan-out.
- **What exists today:** results record their methodology version, and reads
  flag a result "Desatualizado" when its title type's current version
  differs. Nothing requeues it; saving the simulation again recalculates it.
- **Done when:** changing a title type's methodology version queues its
  simulations with cause `METHODOLOGY_CHANGED` through the fan-out page path,
  once per change.

## Partial index for unpublished outbox rows (deferred 2026-10-27)

The poller claims unpublished rows that are due or past the grace period.

- **Today:** `outbox_events` is indexed on `(published_at, created_at)`, so
  the index keeps every published row, and nothing removes published rows.
- **Why deferred:** the table is small, and the claim query is fast with the
  current index; the change belongs with an outbox cleanup.
- **Done means:**
  - The claim reads an index that holds unpublished rows only (`WHERE
published_at IS NULL`), generated by Prisma rather than written by hand.
  - Published rows are removed after a retention period, without touching
    audit history (see "Durable audit of premise changes").
  - The benchmark shows no regression in idle cost or claim time.

## Shared compute-once helper for in-call caches (deferred 2026-10-10)

`InvestmentCalculator` caches daily accrual factors per rate in a local `Map`
during one `calculate()` call, with an inline get-or-compute-and-store block.
More calculators and curve conversions are expected to need the same pattern.

- **Today:** the block is written inline in `investment-calculator.domain-service.ts`
  (`accrue()`); it is the only use.
- **Why deferred:** one call site does not justify a shared utility yet.
- **Done means:**
  - `@investflow/shared-domain` exports a `getOrInsertComputed(map, key,
compute)` function in a capability folder (such as `collections/`),
    shaped like the TC39 `Map.prototype.getOrInsertComputed` proposal so it
    can be replaced by the native method once Node ships it.
  - The caller keeps owning the map, its lifetime (one calculation, never a
    long-lived service), and the key (`Decimal` values are keyed by string).
  - No `memoize(fn)` wrapper that hides where the cache lives.
  - The calculator and the new call sites use it, with a focused spec.

## "Saldo hoje" balance (deferred 2026-10-17)

How much a simulation is worth today, so a user can follow an investment
through its term. It is a required feature, not an optional nicety.

- **Today:** the balance chart only marks today with the gross balance of
  the result's last daily balance on or before it, labelled as an estimate
  (roadmap D13). That marker is a read of the result calculated to maturity;
  it is not this feature.
- **Why deferred:** it needs product refinement and a domain concept and
  space of its own. The open questions are in the PRD's "Pendências de
  Produto": the reference date, gross or net (early redemption taxes depend
  on undefined liquidity and redemption rules), prefixed and manual-curve
  simulations and kept rates, simulations not yet invested or matured,
  whether a simulation can represent a realized investment, and an
  investment plan's current value.
- **Done means:**
  - The PRD records the refined rules as a dated decision, and the domain
    models "saldo hoje" as its own concept instead of a lookup in the
    maturity projection.
  - The screens that need it (the workspace, and whichever the decision
    names among the list, the comparison, and investment plans) show it, and the
    D13 marker is replaced or reconciled with it.
  - Tests cover the reference date, the edge states, and the gross/net rule.

## Saved comparisons (deferred 2026-10-27)

- **Today:** a comparison exists only in its URL
  (`/simulacoes/comparar?ids=…`). Investment plans are not saved
  comparisons: they gather what is invested together, whose totals add up,
  while a comparison gathers alternatives, which must never be summed.
- **Why deferred:** no user need for keeping alternatives yet, and the URL
  can be bookmarked.
- **Done when** a user can name and keep a comparison as its own concept,
  apart from plans, and reopen it.

## Creating a private offer and its simulation in one transaction (deferred 2026-10-27)

- **Today:** "Digitar termos" and "Duplicar e ajustar" save the new private
  offer and the simulation in one use case and one transaction
  (`create-simulation.use-case.ts:59-61`), two aggregates where the rule is
  one.
- **Why deferred:** found while planning investment plans, whose design
  follows the rule; changing the create flow is outside that work.
- **Revisit with:** the one-aggregate rule in `investflow-domain-application`:
  either a user-visible step (create the offer, then the simulation) or an
  eventual step, and how the screen recovers when the second step fails.
- **Done when** each use case changes one aggregate, or the exception is
  justified and recorded.

## Investment plan picker filters and search (deferred 2026-10-27)

- **Today:** the "Adicionar simulações" dialog lists the owner's simulations
  newest first, 20 per page, without filters or search.
- **Why deferred:** enough while users have few simulations.
- **Revisit when** users with many simulations have trouble finding one; the
  simulation list's filters (`offerId`, `curveId`, `titleType`,
  `remunerationKind`, `calculationStatus`) and an offer-name search are the
  candidates.
- **Done when** the picker narrows the list with the same URL-free filters
  and keeps the choice across them.

## Separate create and edit mutations in the offer and curve editors (deferred 2026-10-27)

- **Today:** `use-offer-editor.ts:79` and `use-curve-editor.ts:117` run one
  `save` mutation that branches on whether a baseline exists, against the
  `investflow-react` rule that create and edit are separate mutations. The
  simulation and investment plan editors already follow it.
- **Why deferred:** behavior is correct today; splitting them is a
  refactor outside the investment plan work.
- **Done when** each editor has a create and an edit mutation, with the
  pending-window rule of `use-simulation-creation.ts` (only steps that cannot
  fail run in `onSuccess` before navigating), and their hook tests cover
  both.
