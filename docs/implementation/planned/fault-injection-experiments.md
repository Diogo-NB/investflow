# Fault Injection and Integrity Experiments

> **Status: pending, not started.** Agreed 2026-11-11 and redesigned
> 2026-11-14: what an event carries is now the factor under test, instead of
> a fixed condition. Runs on a staging stack only. Delete this file once the
> experiments are done and their outcomes are recorded in the docs that own
> each area.

It changes nothing in production by default. It revives the staging item of
[Production Hardening](./production-hardening.md) and builds on
[Messaging Transport](../../architecture/messaging.md),
[Recalculation](../../architecture/recalculation.md), and the failure tables
in [Event Flow](../../architecture/event-flow.md).

## Why

The messaging path prevents loss and duplication (outbox, FIFO exclusivity
per aggregate, `processed_events`, the revision guard, retries and
dead-letter queues), but nothing checks that a derived value is correct
once it is written. Some faults leave a trace, such as a message in a
dead-letter queue. Others are silent and show a wrong result as settled:
"No gap check" in Messaging Transport accepts one of them.

Which faults stay silent depends on what events carry. Recalculation events
carry identifiers only and consumers read current state (see "Model" in
Recalculation), which makes the last message of a group always right, but
leaves nothing to replay and ties the consumer to the producer's tables.
`PublishedIndexValuesImported` carries values because contexts cannot read
each other's tables, and its consumer applies only the dates after the
curve's end: it is a delta, and "No gap check" is exactly a lost delta
followed by a success.

The first design kept identifier-only events as a fixed condition and hit
three dead ends, all caused by them: the input fingerprint made almost every
fault a disabled protection let through visible, so there was little silent
damage to measure; an oracle recomputing from current state inherited the gap
of a dropped index import (see Findings); and a logic error could not be
repaired without privileged knowledge of the correct code. Since the system
can change, what events carry became the factor.

The experiments answer, on real infrastructure and on the recalculation
path:

1. Which faults exist only because events are notifications, and which only
   because they carry state?
2. When events carry state, do the revision guard and deduplication become
   necessary again? (FIFO exclusivity per aggregate stays on; see
   "Protections turned off one at a time".)
3. Does a retained log repair faults that recalculation from current state
   cannot, and how much of that survives finite retention, deduplication,
   and a schema change?
4. When the producer's database and its events disagree, which one does the
   consumer follow, and is the disagreement silent?
5. In which faults do reprocessing the log and recalculating from current
   state reach different results?
6. What does each event style cost (message size, schema and its evolution,
   retention, consumer code), and does a middle ground (delta, notification
   with revision) keep most of the gain?

## Scope

### Staging stack

A second Dokploy environment and AWS stack with production's topology:
EventBridge, the same FIFO queues and dead-letter queues, its own database
and IAM user. `InvestflowMessagingStack` takes the environment name so its
resources do not collide with production's. Floci is not enough: it treats
every queue as one FIFO group (see "Local emulation" in Messaging
Transport), which hides exactly the concurrency the experiments measure.
Each variant below is a configuration or a branch deployed to staging, never
to production.

### Variants: what an event carries

Applied to the recalculation path: the offer, curve, and simulation events
and the calculation consumer.

| Variant                                  | The event carries                                                   | The consumer calculates from                                              |
| ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| V1 Notification (current)                | identifiers                                                         | current state read from the database                                      |
| V2 Delta                                 | the changed fields                                                  | a local copy updated by the deltas                                        |
| V3 State                                 | the entity's whole state (offer terms, curve intervals, simulation) | a local copy updated by the events, without reading the producer's tables |
| V4 Notification with revision (optional) | identifiers and the revision of the change                          | current state, read only once it is at least the announced revision       |

- In V2 and V3 the consumer may not read the producer's tables, the rule
  that already holds between contexts (`market-data` and the simulator), so
  the variants behave like separate services.
- V2 reuses V3's local copy; only what the event carries and how it is
  applied change. It is needed because, without it, a lost event (F1)
  separates no variant, and because it is the style of the one real case,
  "No gap check".
- V4 runs only against a read that lags the event (F4), the one fault where
  it differs from V1.
- V2 and V3 break two rules of `investflow-eventing` on purpose, "Keep
  payloads minimal" and "Consumers read current state", so they stay
  confined to staging until the findings say otherwise (decision 5).

### Faults

Every fault is applied by a switch (see "Fault switches"), the same for every
variant.

| Fault         | What happens                                                    | How it is injected                                                                              |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| F1            | An event is lost and a later one of the same aggregate succeeds | Dead-letter one event and let the next pass                                                     |
| F2            | A late event arrives after a newer one                          | Delay one message, or redrive an old event from the dead-letter queue, with FIFO exclusivity on |
| F3            | A message is delivered twice                                    | Repeat a message, with deduplication on and off                                                 |
| F4            | The read lags the event (a dependency across channels)          | Staging only: the consumer reads state as it was X seconds ago; X is a parameter of the run     |
| F5            | A logic error in the consumer, fixed later                      | Swap the calculation for a faulty one, then restore it                                          |
| F6            | The producer's database and its event disagree                  | Publish an event whose state differs from what was saved (a dual write without the outbox)      |
| F7 (optional) | An old consumer receives an event with a new schema             | Publish a new version of an event before updating the consumer                                  |

F4 does not happen today: the database is one PostgreSQL instance on the
Dokploy server, with no replica. The delay is injected in the read rather
than by a real replica with delayed apply (decided 2026-11-14), because the
experiments measure the mechanism, not how often it happens, and an injected
delay shows it with the same control as the other faults without taking
memory on the shared server. A real replica would need its delayed-apply
setting checked in the PostgreSQL documentation.

### Protections turned off one at a time

Against F2 and F3 only: the revision guard and deduplication, turned off one
at a time in each variant. This answers question 2.

FIFO exclusivity per aggregate stays on in every run (decided 2026-11-15).
It was the only protection whose outcome, once off, depends on two messages
of the same aggregate coinciding, which needed a pilot, many runs, and a
statistical analysis; without it every run is deterministic. What is lost:
the effect of processing two events of the same aggregate at once is not
measured, and is recorded as a limitation. To confirm when building it: that
F3 with deduplication off (the same message delivered twice) gives a
deterministic outcome.

### Fault switches

Every switch defaults off, is read from the environment at start, and the
API refuses to start with any switch on unless the environment is staging
(see "Environment Configuration" in Project Structure).

| Switch                           | What it does                                                                                | Used for        |
| -------------------------------- | ------------------------------------------------------------------------------------------- | --------------- |
| Event content                    | Selects V1, V2, V3, or V4 for the recalculation path                                        | Variants        |
| Publish without the outbox       | Commits, then publishes directly, with an optional crash between the two                    | F6              |
| Write without the revision guard | The worker saves its outcome without the `simulation_revision` condition                    | Protections     |
| Skip deduplication               | `EventDispatcher` runs the handler without recording `processed_events`                     | F3, protections |
| Drop, duplicate, or delay        | The listener drops, repeats, or holds selected messages before dispatching                  | F1, F2, F3      |
| Lagging read                     | The calculation reads offers, curves, and simulations as they were a set time ago           | F4              |
| Logic error                      | The worker uses a calculation with a deliberate error; the input fingerprint stays the same | F5              |
| New event version                | The producer raises a new `version` of an event the consumer does not know yet              | F7              |

"Publish without the outbox" breaks "never publish from a use case" in
`investflow-eventing` on purpose, which is why it must stay confined to
staging (decision 3).

### Repair strategies

- **R1. Recalculation from current state.** Rebuild a result through the
  normal calculation, reading current state. It exists per simulation
  (`POST simulations/:id/recalculate`, "Tentar novamente"); a sweep or a
  batch recalculation does not exist yet and has to be built.
- **R2. Reprocessing the retained log.** Consume the retained events again to
  rebuild the derived state. Decided 2026-11-14:
  - **Where.** In the outbox itself, not in a separate log table. R2 reads
    published rows from `outbox_events` and needs a replay path that
    `processed_events` does not discard. Every handler on that path must be
    idempotent.
  - **How long.** On staging, `OUTBOX_RETENTION_DAYS` is set to years; the
    retention code, which production shares, does not change.
  - **Retention as a level.** Against F5, R2 runs with the full log and with a
    truncated one, shorter than the time since the affected change. The
    truncated level is what answers finite retention in question 3.
  - Under V1, retention does not help: reprocessing notifications reads
    current state again, which is R1.
- **E1. Dead-letter alarm and redrive**, as the reference. It overlaps the
  "Dead-letter alarms" item of Production Hardening. Redriving a dropped
  index import changes nothing (see "No gap check"), which the experiment
  should confirm.

The fingerprint sweep and the source sweep of the first design are dropped:
under V1 the fingerprint sweep finds nothing a dropped event leaves wrong
(see Findings), and the source sweep compared the stored series, which is
already correct.

### Oracle

A script that recomputes every simulation result from the systems of record
in a clean copy of the database, at decimal precision, and reports each
stored result that differs, is stuck in `PENDING`, or is `FAILED`. It does
not start from derived data: for the system curves the system of record is
the published series (`PublishedIndexSeries`), not the curve, which closes
the gap of a dropped index import. Against F5 it runs the correct
calculation, which is legitimate there because the fault measures repair
after the fix, not detection.

### Expected outcomes, to be checked

Written before any run so a run can contradict them; a difference is a
finding.

| Fault | V1 Notification                                                    | V2 Delta                                                                                         | V3 State                                                          |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| F1    | the next event reads current state: corrects itself                | the lost change never comes back: wrong and silent, for good                                     | the next event carries the whole state: corrects itself           |
| F2    | immune, since it reads current state                               | the old delta rewrites fields with old values, unless versions are checked                       | the old state overwrites the new one, unless versions are checked |
| F3    | harmless                                                           | harmless when the delta sets values; applied twice if it is incremental and deduplication is off | harmless                                                          |
| F4    | wrong for good and silent (V4 waits for the revision and is right) | immune, since it does not read the producer                                                      | immune, since it does not read the producer                       |
| F5    | R1 repairs the current result                                      | R1 and R2 repair; R2 only if the log covers the origin                                           | R1 and R2 repair; R2 also rebuilds the history                    |
| F6    | follows the database                                               | follows the event, silently diverging from the system of record                                  | follows the event, silently diverging from the system of record   |

The deltas in this system set values (the index import applies the dates
after the curve's end), so F3 probably separates no variant with
deduplication on; turning deduplication off is what makes it informative.
Without the first delta, V2 cannot rebuild an entity from a truncated log,
while V3 needs only each entity's last state event.

### Measurements

Per variant and fault, and per protection turned off where there is one:

- **The derived result's final state:** correct; visible (`PENDING` or
  "Desatualizado"); wrong with an alarm; or wrong and silent, shown as
  settled with no alarm.
- **Time in each state** until it converges or the run ends.
- **Repair:** whether R1, R2, and E1 restore the correct value, and how
  fast.
- **Cost of each variant:** mean message size, storage of the retained log,
  code changed (modules and files), schema fields and versioning rules, and
  calculation latency of normal traffic (p50, p95, p99) as a side effect.

A traffic generator in `tools/` produces background load, and a runner
script applies a scenario (variant, switches, faults, repair), waits, runs
the oracle, and writes the results as CSV, so every run can be repeated.

**Repetitions (decided 2026-11-14, revised 2026-11-15).** Every run is
deterministic: F1 to F7, with or without the revision guard or deduplication
off, and F2 with the old event coming from a redrive or an injected delay.
Each runs 3 times, to confirm the outcome repeats. If a run varies, that is a
finding: it is treated as probabilistic, and its number of runs comes from a
pilot that measures the variation, recorded here before the measured runs.

## Decisions needed first

1. **Where staging runs.** A second Dokploy environment on the shared VPS
   (simplest, but Production Hardening notes the memory budget) or a
   separate host for the experiment period. Recommended: the VPS, measured
   with the API's memory limit, unless the traffic generator does not fit.
   The database stays on the Dokploy server, with no replica (see F4).
2. **How switches are carried.** Environment variables validated at start
   (recommended: a run has fixed conditions and a restart between scenarios
   is cheap) or a runtime endpoint (faster scenario changes, but one more
   attack surface).
3. **Where experiment-only code lives.** A separate library imported only
   when a switch is on, so production code paths keep their rules
   (recommended), or switches inline in the existing classes. The variants
   make this harder: V2 and V3 change what events carry and what the
   consumer reads, so they may need a branch rather than a switch.
4. **Data.** The seed scaled up, or an anonymized copy of production.
   Recommended: the seed, so runs are reproducible and no personal data
   leaves production.
5. **Afterwards.** Nothing changes in production now. If V2 or V3 prove
   better, decide which variant production adopts and whether retention
   grows for R2. Under V1 retaining events does not help; by what Messaging
   Transport documents, its cost would be mostly storage.
6. **How V2 and V3 reach the calculation consumer.** Today offer and curve
   events go to `SimulationRecalculationConsumer`, which records one
   identifier-only `SimulationCalculationRequested` per simulation. With
   state, either the fan-out carries the premises' state to each simulation,
   or the calculation consumer subscribes to offer and curve events to keep
   its copy. Check that a whole curve's intervals fit the outbox's 200 KB
   payload limit before choosing. Decide when V3 is built.

## Findings

Record each finding with its date in the doc that owns the area (a changed
decision in Messaging Transport or Recalculation, a new failure row in Event
Flow), and list it here with a link until this file is deleted.

- **2026-11-12, a dropped index import is invisible to recalculation.** After
  a dropped `PublishedIndexValuesImported` and a later success, the stored
  index series is correct and the system curve is not; nothing else changes.
  The missing days keep the last rate. If the later import only extends the
  curve, `valuesRevision` does not move; if it changes the rate, the
  simulations are recalculated, still over the missing days. Either way every
  result is current for its fingerprint, so a fingerprint sweep finds
  nothing, a full rebuild recalculates from the same curve, and an oracle
  reading current state inherits the gap. Re-importing through the normal
  path changes nothing either, since the consumer ignores dates up to the
  curve's end. The dead-letter alarm fires, so the fault is detected but not
  repaired by redrive. Consequences: the oracle recomputes from the published
  series (see Oracle), and the fault is F1's real case. It is the gap "No gap
  check" in [Messaging Transport](../../architecture/messaging.md) already
  accepts, which stays accepted.

## Done when

The staging stack runs; each variant can be deployed and each switch and
fault applied and reverted by configuration; the oracle reports every
mismatch; R1 in batch, R2, and E1 are built; a scenario runs from one
command and can be repeated; and the findings are recorded in the docs that
own each area.
