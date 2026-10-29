# Deferred Work

Work that was consciously postponed but must still be implemented. Each item
says why it was deferred, what exists today, and what "done" means. Remove an
item when it ships.

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

## Composed screen reads without one snapshot (deferred 2026-10-28)

- **Today:** the investment plan details, the simulation comparison, the
  simulation workspace, and the simulation list run their domain read (a read
  use case or `SimulationResultValidityReader`) and their own screen read as
  separate statements outside a transaction (`@SkipTransaction()`), so a
  calculation committed between them can rank or total a result other than
  the one shown, or show a status that disagrees with `isSettled`. The
  comparison polls only while a shown status is `PENDING`, so it can stay
  inconsistent until the next load; the workspace polls every 3 seconds.
- **Why deferred:** the window is one round trip, and closing it needs a
  read-only `REPEATABLE READ` mode for the unit of work, a change of its own.
- **Revisit when** users report a verdict or total that disagrees with the
  figures shown, or another screen composes reads this way.
- **Done when** a composed screen read sees one snapshot.

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

## Trigram index for offer and simulation search (deferred 2026-10-28)

- **Today:** the `q` search of `GET offers` and `GET simulations` is a
  case-insensitive `contains` (`ILIKE '%…%'`), which no B-tree index serves.
  The simulation search runs after the `ownerId` index narrows the rows, so
  it scans one owner's simulations; the offer search scans the offers
  visible to the user.
- **Why deferred:** both scans are bounded by what one user owns or sees,
  and a `pg_trgm` GIN index needs a hand-written migration (the extension
  and the operator class) with no measured need.
- **Revisit when** a search is measurably slow for a user with many
  simulations or a large offer catalog.
- **Done when** `pg_trgm` GIN indexes on the offer's name and issuer serve
  both searches, confirmed with `EXPLAIN ANALYZE`.

## Time-partitioned outbox (deferred 2026-10-28)

- **Today:** `OutboxRetentionService` deletes published rows older than 7
  days in batches of 1,000, and autovacuum reclaims the dead rows they leave
  (`docs/architecture/messaging.md`).
- **Why deferred:** at about 1/7 of the table deleted per day, autovacuum's
  defaults keep up, and Prisma cannot model a partitioned table, so it needs
  hand-written migrations.
- **Revisit when** vacuum on `outbox_events` becomes a measurable cost
  (bloat, I/O, or replication lag during cleanup).
- **Done when** the outbox is partitioned by day and retention drops whole
  partitions instead of deleting rows.

## Retention of processed events (deferred 2026-10-28)

- **Today:** `EventDispatcher` writes one `processed_events` row per consumer
  and event, and nothing deletes them, so the table grows forever.
- **Why deferred:** its safe retention depends on how late a duplicate can
  arrive (SQS message retention, and a dead-letter redrive up to 14 days
  later), not on the outbox's 7 days, so it is a separate decision.
- **Done when** rows older than the redelivery horizon are deleted in
  bounded batches, like the outbox's retention.
