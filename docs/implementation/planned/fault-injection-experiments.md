# Fault Injection and Integrity Experiments

> **Status: pending, not started.** Agreed 2026-11-11; its design is still
> open (see "Decisions needed first"). Runs on a staging stack only. Delete
> this file once the experiments are done and their outcomes are recorded in
> the docs that own each area.

It changes nothing in production by default. It revives the staging item of
[Production Hardening](./production-hardening.md) and builds on
[Messaging Transport](../../architecture/messaging.md),
[Recalculation](../../architecture/recalculation.md), and the failure tables
in [Event Flow](../../architecture/event-flow.md).

## Why

The messaging path prevents loss and duplication (outbox, FIFO exclusivity
per aggregate, `processed_events`, the revision guard, retries and
dead-letter queues), but nothing checks that a derived value is correct
once it is written. Some failures leave a trace, such as a message in a
dead-letter queue. Others are silent and show a wrong result as settled:
"No gap check" in Messaging Transport accepts one of them.

The experiments answer two questions on real infrastructure:

1. What does each protection actually prevent? Turn one off at a time, and
   some in pairs, inject the fault it exists for, and measure the damage.
2. With every protection on, which detection and repair strategy finds and
   fixes the faults that still get through, how fast, and at what cost?

## Scope

### Staging stack

A second Dokploy environment and AWS stack with production's topology:
EventBridge, the same FIFO queues and dead-letter queues, its own database
and IAM user. `InvestflowMessagingStack` takes the environment name so its
resources do not collide with production's. Floci is not enough: it treats
every queue as one FIFO group (see "Local emulation" in Messaging
Transport), which hides exactly the concurrency the experiments measure.

### Oracle

A script that recomputes every simulation result from current state in a
clean copy of the database, at decimal precision, and reports each stored
result that differs, is stuck in `PENDING`, or is `FAILED`. It runs the
unmodified calculation, so an injected logic error in the worker shows up
as a difference.

### Fault switches

Every switch defaults off, is read from the environment at start, and the
API refuses to start with any switch on unless the environment is staging
(see "Environment Configuration" in Project Structure).

| Switch                           | What it does                                                                                | Protection it tests            |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| Publish without the outbox       | Commits, then publishes directly, with an optional crash between the two                    | Transactional outbox           |
| Write without the revision guard | The worker saves its outcome without the `simulation_revision` condition                    | Revision guard                 |
| Standard queues                  | A stack variant with standard instead of FIFO queues                                        | FIFO exclusivity per aggregate |
| Skip deduplication               | `EventDispatcher` runs the handler without recording `processed_events`                     | Deduplication                  |
| Drop, duplicate, or delay        | The listener drops, repeats, or holds selected messages before dispatching                  | Fault source for the above     |
| Fail a handler N times           | Selected events throw until dead-lettered                                                   | Retries and dead-letter queues |
| Drop an index import             | One `PublishedIndexValuesImported` is dead-lettered and a later one succeeds                | None: the accepted gap         |
| Logic error                      | The worker uses a calculation with a deliberate error; the input fingerprint stays the same | None                           |

"Publish without the outbox" breaks "never publish from a use case" in
`investflow-eventing` on purpose, which is why it must stay confined to
staging (decision 3).

### Detection and repair strategies

- **Dead-letter alarm and redrive.** An alarm when a dead-letter queue
  receives a message, and an automatic move back to its source queue. It
  overlaps the "Dead-letter alarms" item of Production Hardening. Redriving a
  dropped index import changes nothing (see "No gap check"), which the
  experiment should confirm.
- **Fingerprint sweep.** A periodic job that finds simulations whose stored
  fingerprint differs from the one built from current versions, or that stay
  `PENDING` or `FAILED` past a threshold, and records
  `SimulationCalculationRequested` for them. Its interval is an experiment
  variable.
- **Source sweep.** A periodic job that compares each stored index series
  with the Banco Central's and re-imports missing or different days, which
  closes the accepted gap.
- **Full rebuild** (optional). Recalculate every simulation.
- **Changed-in-window recalculation** (optional). Keep published outbox rows
  longer and recalculate only the aggregates that changed in a time window.
  Replaying events in order would not rebuild state, because most events
  carry identifiers only and consumers read current state; deduplication
  would also skip a replayed event.

### Measurements

Per run: time to detect, time to repair, detection and repair rates, the time
a wrong result is shown as settled, false alarms, unnecessary recalculations,
database load during sweeps, and calculation latency percentiles (p50, p95,
p99) of normal traffic. A traffic generator in `tools/` produces background
load, and a runner script applies a scenario (switches, faults, strategy),
waits, runs the oracle, and writes the results, so every run can be
repeated.

## Decisions needed first

1. **Where staging runs.** A second Dokploy environment on the shared VPS
   (simplest, but Production Hardening notes the memory budget) or a
   separate host for the experiment period. Recommended: the VPS, measured
   with the API's memory limit, unless the traffic generator does not fit.
2. **How switches are carried.** Environment variables validated at start
   (recommended: a run has fixed conditions and a restart between scenarios
   is cheap) or a runtime endpoint (faster scenario changes, but one more
   attack surface).
3. **Where experiment-only code lives.** A separate library imported only
   when a switch is on, so production code paths keep their rules
   (recommended), or switches inline in the existing classes.
4. **Data.** The seed scaled up, or an anonymized copy of production.
   Recommended: the seed, so runs are reproducible and no personal data
   leaves production.
5. **Afterwards.** Whether the fingerprint and source sweeps ship to
   production if they prove worth their cost; the source sweep would replace
   the accepted gap in "No gap check".

## Findings

Record each finding with its date in the doc that owns the area (a changed
decision in Messaging Transport or Recalculation, a new failure row in Event
Flow), and list it here with a link until this file is deleted.

None yet.

## Done when

The staging stack runs; each switch and fault can be applied and reverted by
configuration; the oracle reports every mismatch; each strategy in scope is
built; a scenario runs from one command and can be repeated; and the
findings are recorded in the docs that own each area.
