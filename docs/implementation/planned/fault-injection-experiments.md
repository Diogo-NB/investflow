# Fault Injection and Integrity Experiments

> **Status: pending, not started.** Agreed 2026-11-11 and redesigned
> 2026-11-14: what an event carries is now the factor under test, instead of
> a fixed condition. Runs only against its own AWS messaging stack, with the
> API and database on a local machine. Delete this file once the
> experiments are done and their outcomes are recorded in the docs that own
> each area.

It changes nothing in production by default. It builds on
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
   cannot, and how much of that survives finite retention and
   deduplication?
4. When the producer's database and its events disagree, which one does the
   consumer follow, and is the disagreement silent?
5. In which faults do reprocessing the log and recalculating from current
   state reach different results?
6. What does each event style cost (message size, schema and its evolution,
   retention, consumer code), and does a middle ground (delta) keep most of
   the gain?

## Scope

### Experiment environment

Decided 2026-11-20: only the messaging runs on AWS. A second
`InvestflowMessagingStack` with production's topology (EventBridge, the same
FIFO queues and dead-letter queues) and its own IAM user, in the same
account and region, deployed with the same credentials as production's; the
stack is the `homolog` environment, whose resource names end in `-homolog`
so they do not collide with production's (see "Environments" in Production
Deployment), and is destroyed once the experiments end. The
account's spending limit is far above what the runs cost. The API, the
database, and the runner run on a local machine, against the local Docker
PostgreSQL.

- **Credentials.** The experiment user's access key is created by hand, like
  `investflow-api`'s (see "AWS" in Production Deployment), and its policy
  covers only the experiment stack's resources. It has no `aws:SourceIp`
  condition, since the local machine's address is not fixed; the key is
  deleted with the stack.
- **Why not Floci.** It treats every queue as one FIFO group (see "Local
  emulation" in Messaging Transport), so messages of different aggregates
  are processed strictly in publish order. On AWS they run in parallel: an
  offer or curve event and a `SimulationCalculationRequested` sit in
  different groups, so under V2 and V3 a calculation can run before the
  consumer's copy is updated (decision 5). Floci hides that.
- **Why not a staging environment.** A second Dokploy environment would add
  a deployment, credentials on the server, and load on the shared VPS's
  memory budget, while the experiments measure the mechanism, not the
  deployment. The `staging` item of
  [Production Hardening](./production-hardening.md) stays postponed on its
  own trigger.

Each variant below is selected by a switch in this environment, never
deployed to production.

**Dead-letter alarms first (decided 2026-11-20, built 2026-11-21).** The
alarms are built before the experiments, in `InvestflowMessagingStack`, so
production and the experiment stack get the same ones. There is one per
dead-letter queue, each with an email notification; the metrics are in
"Dead-letter alarms" in Messaging Transport. Without them, a dead-lettered
message is only a trace someone finds by looking, and "wrong with an alarm"
could not be told from "wrong and silent". The calculations queue's alarm
clears a minute after it fires, so the oracle reads whether an alarm entered
`ALARM` during the run from its history, not its state at the end. The
notification address is a stack parameter, as "Alarm address" in Production
Deployment describes.

### Variants: what an event carries

Applied to the recalculation path: the offer, curve, and simulation events
and the calculation consumer.

Only this path varies (decided 2026-11-19). The index import cannot run V1:
its consumer is in another context and cannot read the market-data tables,
so a notification there breaks the rule between contexts. The recalculation
path runs all variants inside one context, V1 as built and V2 and V3 with
the producer's tables forbidden. Its V2 against F1 reproduces the lost delta
of "No gap check", so varying the import too adds conditions without a new
mechanism, and faults on the import would reach the simulations through the
system curves and mix two paths in one result. The import runs unchanged.

| Variant                   | The event carries                                                   | The consumer calculates from                                              |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| V1 Notification (current) | identifiers                                                         | current state read from the database                                      |
| V2 Delta                  | the changed fields                                                  | a local copy updated by the deltas                                        |
| V3 State                  | the entity's whole state (offer terms, curve intervals, simulation) | a local copy updated by the events, without reading the producer's tables |

- In V2 and V3 the consumer may not read the producer's tables, the rule
  that already holds between contexts (`market-data` and the simulator), so
  the variants behave like separate services.
- V2 reuses V3's local copy; only what the event carries and how it is
  applied change. It is needed because, without it, a lost event (F1)
  separates no variant, and because it is the style of the one real case,
  "No gap check".
- A notification with the revision of the change, whose consumer reads
  current state only once it reaches that revision, was an optional fourth
  variant against a read that lags the event (F4), and is dropped
  (2026-11-20) to fit the schedule.
- V2 and V3 break two rules of `investflow-eventing` on purpose, "Keep
  payloads minimal" and "Consumers read current state", so they stay
  confined to the experiment environment until the findings say otherwise
  (decision 4).

### Faults

Every fault is applied by a switch (see "Fault switches"), the same for every
variant.

| Fault | What happens                                                    | How it is injected                                                                             |
| ----- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| F1    | An event is lost and a later one of the same aggregate succeeds | Dead-letter one event and let the next pass                                                    |
| F2    | A late event arrives after a newer one of the same aggregate    | F2a or F2b below, both with FIFO exclusivity on                                                |
| F3    | A message is delivered twice                                    | Repeat a message, with deduplication on and off                                                |
| F4    | The read lags the event (a dependency across channels)          | Experiment only: the consumer reads state as it was X seconds ago; X is a parameter of the run |
| F5    | A logic error in the consumer, fixed later                      | Swap the calculation for a faulty one, then restore it                                         |
| F6    | The producer's database and its event disagree                  | Publish an event whose state differs from what was saved (a dual write without the outbox)     |

A schema change (an old consumer receiving a new event version) is out of
scope (decided 2026-11-16): the schema cost of each style is still measured,
but no run injects a new version.

F2 has two sources in this system, and both run (decided 2026-11-20):

- **F2a. Publishing retry.** The broker rejects an event, the outbox retries
  it after its backoff (see "Publishing failures" in Messaging Transport),
  and a newer event of the same aggregate is published meanwhile, so it
  enters the group first. The switch reports the selected event as rejected
  without sending it until a newer event of the same aggregate has been
  published, so the order does not depend on the backoff window; the
  rejection and the retry are the real ones.
- **F2b. Redrive.** The selected event is dead-lettered as in F1, the next
  one passes, and the runner redrives the old one. It is the reference
  repair (E1) producing a late event, which shows whether redrive is safe
  once events carry content. Dead-lettering takes 5 receives of the 30 s
  visibility timeout, about 2.5 minutes, kept so the topology stays
  production's.

Delaying a message in the listener cannot produce F2: under FIFO
exclusivity a held message holds its group, and letting the newer one pass
means deleting the old one first, which turns exclusivity off.

F4 does not happen today: the database is one PostgreSQL instance with no
replica. The delay is injected in the read rather than by a real replica
with delayed apply (decided 2026-11-14, kept 2026-11-20 once the database
moved to the local machine): the experiments measure the mechanism, not how
often it happens, and an injected delay shows it with the same control as
the other faults, with X as a parameter and a deterministic outcome. The
lagging read returns the old revisions with the old values, as a replica
would, so the recorded fingerprint reflects what was read. Rejected, kept
in case it is asked for: a replica read only by the calculation, with
`recovery_min_apply_delay` (to be checked in the PostgreSQL documentation).

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
API refuses to start with any switch on unless it publishes to the
experiment stack's bus, so a production deploy cannot turn one on (see
"Environment Configuration" in Project Structure).

| Switch                           | What it does                                                                                | Used for        |
| -------------------------------- | ------------------------------------------------------------------------------------------- | --------------- |
| Event content                    | Selects V1, V2, or V3 for the recalculation path                                            | Variants        |
| Publish without the outbox       | Commits, then publishes directly, with an optional crash between the two                    | F6              |
| Write without the revision guard | The worker saves its outcome without the `simulation_revision` condition                    | Protections     |
| Skip deduplication               | `EventDispatcher` runs the handler without recording `processed_events`                     | F3, protections |
| Dead-letter or duplicate         | The selected message fails every receive until dead-lettered, or is dispatched twice        | F1, F2b, F3     |
| Reject until a newer event       | Publishing reports the selected event as rejected until a newer one of its aggregate passes | F2a             |
| Lagging read                     | The calculation reads offers, curves, and simulations as they were a set time ago           | F4              |
| Logic error                      | The worker uses a calculation with a deliberate error; the input fingerprint stays the same | F5              |

"Publish without the outbox" breaks "never publish from a use case" in
`investflow-eventing` on purpose, which is why it must stay confined to
the experiment environment (decision 2).

#### Selecting the target

Decided 2026-11-20. A switch that targets one message selects it by
aggregate, event type, and ordinal within that aggregate, such as "the second
`OfferTermsChanged` of offer `<id>`", on both sides of the transport: the
outbox row and the received envelope both carry the event type, event ID,
and aggregate ID. Within one aggregate the order is deterministic, because
its messages are exclusive in their FIFO group and the runner makes its
changes one at a time; other aggregates' events do not move the count. The first match pins the event ID, so a fault that
repeats on every receive, such as dead-lettering, keeps hitting the same
event.

Identifiers are UUIDs generated by the server, so a scenario runs in two
phases: the runner creates the scenario's entities through the API and keeps
the returned IDs, waits for the queues to empty, restarts the API with the
switches and the selector, then makes the target's changes. Rejected: an
ordinal across all events of a type, which differs between runs once
aggregates are consumed in parallel; and setting the target at run time in a
table or through an endpoint, which would add a migration to production's
schema or the attack surface of decision 1's runtime endpoint.

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
  - **How long.** In the experiment environment, `OUTBOX_RETENTION_DAYS` is
    set to years; the retention code, which production shares, does not
    change.
  - **Retention as a level.** Against F5, R2 runs with the full log and with a
    truncated one, shorter than the time since the affected change. The
    truncated level is what answers finite retention in question 3.
  - Under V1, retention does not help: reprocessing notifications reads
    current state again, which is R1.
- **E1. Dead-letter alarm and redrive**, as the reference, with the alarms
  built first (see "Experiment environment"). Redriving a dropped
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

When it compares (decided 2026-11-16): once the fault is applied, the runner
stops making changes and waits for the system to settle: empty queues, retry
queues included, no simulation in `PENDING`, and 60 seconds with no change
(longer than the longest retry delay; to be checked against the queue
settings). Only then does the final comparison run. During the run the
oracle samples every 5 seconds, to measure time in each state. A result that
differs at the final comparison is an error: silent if shown as settled with
no alarm, with an alarm if a dead-letter alarm entered the `ALARM` state during the
run or the simulation is `FAILED`, and visible if it shows `PENDING` or
"Desatualizado". The runner reads
the alarms' state, which also gives the time until detection. One
that differed and converged before the end is a delay. A dead-lettered
message does not come back on its own and counts as settled; redrive (E1) is
measured separately, as a repair.

### Expected outcomes, to be checked

Written before any run so a run can contradict them; a difference is a
finding. Revised 2026-11-20 from reading the mechanism, still before any
run: V2 against F1 gained the dead-letter alarm once the alarms were
scheduled, and V1 against F4 is visible rather than silent, because the
worker records the fingerprint of the revisions it read and the screen
compares it with the current ones (see "Input fingerprint" in
Recalculation). The lagging read must lag the revisions with the values for
this to hold.

| Fault | V1 Notification                                     | V2 Delta                                                                                                                                                                                                      | V3 State                                                                        |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| F1    | the next event reads current state: corrects itself | the lost change never comes back: wrong for good, shown as settled, with the dead-letter alarm; redriving it (E1) tends to be dropped by the revision guard, since it is older than the delta already applied | the next event carries the whole state: corrects itself                         |
| F2    | immune, since it reads current state                | with the revision guard (default), a late delta that changed another field is dropped and the change is lost; without it, one that changed the same field rewrites the old value; silent either way           | the old state silently overwrites the new one, since the copy checks no version |
| F3    | harmless                                            | harmless when the delta sets values; applied twice if it is incremental and deduplication is off                                                                                                              | harmless                                                                        |
| F4    | wrong for good, but visible as "Desatualizado"      | immune, since it does not read the producer                                                                                                                                                                   | immune, since it does not read the producer                                     |
| F5    | R1 repairs the current result                       | R1 and R2 repair; R2 only if the log covers the origin                                                                                                                                                        | R1 and R2 repair; R2 also rebuilds the history                                  |
| F6    | follows the database                                | follows the event, silently diverging from the system of record                                                                                                                                               | follows the event, silently diverging from the system of record                 |

The deltas in this system set values (the index import applies the dates
after the curve's end), so F3 probably separates no variant with
deduplication on; turning deduplication off is what makes it informative.
Without the first delta, V2 cannot rebuild an entity from a truncated log,
while V3 needs only each entity's last state event.

### Measurements

Per variant and fault, and per protection turned off where there is one:

- **The derived result's final state:** correct; visible (`PENDING` or
  "Desatualizado"); wrong with an alarm (a dead-letter alarm that entered
  `ALARM` during the run, or the simulation `FAILED`); or wrong and silent, shown as settled with no
  alarm.
- **Time in each state** until it converges or the run ends.
- **Repair:** whether R1, R2, and E1 restore the correct value, and how
  fast.
- **Cost of each variant:** mean message size, storage of the retained log,
  code changed (modules and files), and schema fields and versioning rules.

Calculation latency (p50, p95, p99) is not measured (decided 2026-11-20):
percentiles need many samples under controlled load, which three
deterministic runs per condition do not give, and they do not answer
integrity. For the same reason there is no traffic generator: each scenario
makes only the changes its fault needs.

A runner in `tools/` applies a scenario (variant, switches, faults, repair),
waits, runs the oracle, and writes the results as CSV under the git-ignored
`tmp/`, so every run can be repeated. It follows the tools conventions in
`AGENTS.md`, with `tools/benchmarks/outbox-latency.ts` as the closest
example, which prints its report instead of writing a file.

**Repetitions (decided 2026-11-14, revised 2026-11-15).** Every run is
deterministic: F1 to F6, with or without the revision guard or deduplication
off, and F2 with the old event coming from a publishing retry (F2a) or a redrive
(F2b).
Each runs 3 times, to confirm the outcome repeats. If a run varies, that is a
finding and is reported as such, with what varied; there is no pilot and no
statistical analysis (decided 2026-11-16).

## Decisions needed first

1. **How switches are carried.** Environment variables validated at start
   (recommended: a run has fixed conditions and a restart between scenarios
   is cheap) or a runtime endpoint (faster scenario changes, but one more
   attack surface).
2. **Where experiment-only code lives.** Decided 2026-11-20: on one
   long-lived experiment branch that never merges into `main`, with each
   variant's code in its own module (one for V2, one for V3) selected by
   the "Event content" switch, so the runner, oracle, and fault switches are
   one copy shared by every variant, and a variant's code changed is counted
   from its module. The code does not have to meet production's bar. Only
   the dead-letter alarms and the stack parameterized by environment name go
   to `main`. When the runs end, the branch is tagged so the runs can be
   reproduced, then deleted. Rejected: a branch per variant, because every
   fix to the shared parts would be applied three times and a run could
   compare variants under different oracles.
3. **Data.** The seed scaled up, or an anonymized copy of production.
   Recommended: the seed, so runs are reproducible and no personal data
   leaves production.
4. **Afterwards.** Nothing changes in production now. If V2 or V3 prove
   better, decide which variant production adopts and whether retention
   grows for R2. Under V1 retaining events does not help; by what Messaging
   Transport documents, its cost would be mostly storage.
5. **How V2 and V3 reach the calculation consumer.** Today offer and curve
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

The experiment stack is deployed and the local API runs against it; each
variant can be run and each switch and fault applied and reverted by
configuration; the oracle reports every mismatch; R1 in batch, R2, and E1 are
built; a scenario runs from one command and can be repeated; the findings are
recorded in the docs that own each area; and the experiment stack is
destroyed.
