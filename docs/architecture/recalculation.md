# Mutable Premises And Asynchronous Recalculation

Decision dated 2026-10-11: offers and index curves are deliberately mutable,
simulations always reference them, and results are recalculated
asynchronously when anything they depend on changes. This replaces the
earlier immutable model (copied offer terms, immutable curves, and an
append-only calculation history kept for reproducibility). Product rules are in
`docs/product/investment-simulator-prd.md` and
`docs/product/index-value-curves.md`.

**Status:** partly implemented. Curves and offers are built on this model:
independent `Curve` and `Offer` aggregates with owners, revisions, and events
in the outbox. `Simulation` references an offer and an optional curve, has its
own revision, and keeps one current `SimulationResult` recording the input
fingerprint of what it was calculated from (see "Input fingerprint");
"Digitar termos" and "Duplicar e ajustar" create a private offer in the same
request. A simulation's own calculation is asynchronous: saving
validates, stores `PENDING`, and the `simulation-calculations` consumer
calculates; a dead-letter consumer records `FAILED`. Offer and curve changes
recalculate the simulations that use them (built 2026-10-26). The design
below was settled on 2026-10-12 and revised on 2026-10-26.

## Model

- A curve is a single aggregate: its index (fixed, and through it the value
  convention), editable name, description, and intervals, its owner, and a
  `revision`. Alternatives of one index are separate curves; screens group
  curves by index and origin, and no grouping is stored (decision 2026-10-11).
  Duplicating copies a curve's content into a new private curve, with no link
  back to its source.
- An offer follows the same single-aggregate model: its title type (fixed,
  and through it the methodology and taxation), editable name, optional
  issuer, remuneration and rate, maturity, and liquidity, its owner, and a
  `revision`. Variants from one issuer are separate offers; screens group
  offers by title type and origin, and no grouping is stored (decision
  2026-10-11). Editing an offer recalculates only the simulations that use
  it. Duplicating copies an offer's terms into a new private offer, with no
  link back to its source.
- Ownership is the Keycloak `sub` (`AuthenticatedUser.userId`); `null` means
  system-owned. Users read their own content plus system content and change
  only their own. System content is written by seed and import processes
  through application use cases, never through HTTP. No application roles are
  needed.
- A simulation references one offer, an optional curve, and
  holds its investment (principal and investment date). Editing any of those
  increments the simulation's own `revision`. A reference to an offer or
  curve that is not visible to the simulation's owner is treated as not
  found.
- `revision` starts at 1 and increments on every persisted change: once per
  save, however many changes the aggregate received in between, so a revision
  always names one persisted state. A `Revision` (`@investflow/shared-domain`)
  tracks it by comparing the current revision with the one last read or
  saved. An aggregate that needs one passes `Revision.initial()` or
  `Revision.restore(n)` to `AggregateRoot` and calls
  `revisionTracker.increment()` from its behavior methods; the others keep
  `Revision.fixed()`, always 1. `AggregateRoot` exposes `revision`, and
  `BaseRepository.save()`
  calls `markPersisted()` so the next change takes a new revision. Commands
  that change an offer, a curve, or a simulation carry the revision the
  client edited;
  a mismatch is a conflict, so concurrent edits (two tabs, a user and an
  import job) never overwrite each other silently. Repositories also update
  from the revision they read (`updateMany` on `id` and revision, 0 rows is
  the same conflict), so two concurrent transactions that both passed the
  check cannot both commit. Commands carry the actor (`string | null`, `null`
  for seed and import processes), and use cases report content the actor
  cannot see as not found and visible content they cannot change as
  `forbidden`.
- Every change to an offer or curve raises a past-tense domain
  event persisted through the transactional outbox (see
  `$investflow-eventing`). Events carry identifiers only. Consumers read
  current state, so events never carry revisions or values, and their size
  does not grow with the content.
- Events name what happened, never a generic "changed" (decided 2026-10-26):
  an offer raises `OfferTermsChanged` (maturity,
  remuneration), `OfferDetailsChanged` (name, issuer, liquidity), and
  `OfferDeleted`; a curve raises `CurveValuesChanged` (intervals),
  `CurveDetailsChanged` (name, description), and `CurveDeleted`. Only terms,
  values, and deletion affect a calculation. Liquidity joins the terms when
  early redemption is calculated.
- Offers and curves keep two counters (decided 2026-10-26):
  `revision`, raised by every change, guards concurrent edits (`409`);
  `termsRevision` on offers and `valuesRevision` on curves, raised only by
  changes that affect a calculation, are what results record. Renaming an
  offer or describing a curve therefore leaves its simulations up to date.

### Input fingerprint

Decided 2026-10-28. A stored value derived from other state records one
`InputFingerprint` (`@investflow/shared-domain`): the versions of the inputs
it was computed from, as a canonical string such as
`v1|simulation:4|offerTerms:2|curveValues:19|methodology:"cdb-252-v1"`. It is
current exactly when the recorded fingerprint equals the one built from the
current versions; for a simulation's result, `SimulationResultValidity`
compares them, and the result is settled when it is current and its
calculation `CALCULATED`. One factory on the owner builds it,
`SimulationResult.inputFingerprintFor()` for simulations, from the
simulation revision, the offer's `termsRevision`, the curve's
`valuesRevision`, and the title type's methodology version (`null` for a
premise that could not be read).

- **Compared, never parsed.** Nothing reads an input back out of a
  fingerprint, so its encoding can change; a new input or a changed meaning
  takes a new encoding version, which makes every recorded fingerprint
  differ.
- **Readable, not hashed.** The inputs are a few short values, so the string
  itself is the fingerprint: it cannot collide and a row shows what a result
  was computed from. Hash only inputs too large to store, such as a whole
  curve.
- **Revisions stay the concurrency tokens.** `revision` guards concurrent
  edits and the worker's conditional save; the fingerprint only says what a
  derivation was computed from.
- **The methodology version is internal.** It is recorded only through the
  fingerprint and never shown.

## Recalculation

Settled on 2026-10-12. `docs/architecture/event-flow.md` walks through the
flow with diagrams and every failure case.

A simulation has one current result. It stores what it was computed from as
one input fingerprint (see "Input fingerprint"). The current fingerprint is
built from the current references, not copied, so it can never drift from
them.

The calculation state is a `SimulationCalculation` value object of the
`Simulation` aggregate, persisted in a 1:1 `simulation_calculation` table next
to `simulation_result`; nothing about it is stored on `simulation`.

| Status       | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `PENDING`    | The inputs changed; a calculation message is queued or being processed.              |
| `CALCULATED` | The stored result matches the inputs the calculation row applies to.                 |
| `INVALID`    | A business rule blocks the calculation; the reason code and metadata are stored.     |
| `FAILED`     | A technical failure exhausted the queue's retries and the message was dead-lettered. |

Every status also records `changedAt`, the simulation revision it was
written for, the input fingerprint of its outcome (`CALCULATED` and
`INVALID` only), and the cause of the last queuing: its kind
(`CREATED`, `SIMULATION_EDITED`, `METHODOLOGY_CHANGED`, `RETRY_REQUESTED`)
and the actor (`null` for system processes). There are no offer or curve
causes: fan-out writes no calculation rows, so nothing would set them, and
premise events carry no actor either. The cause is set when the simulation
is queued and kept by the outcome, so after a premise change "Requer ação"
shows the reason with the simulation's own last cause (see "Recalculation
status on screen" in Deferred Work). Only the current
state is kept; there is no transition history.

- **Requests validate synchronously, then calculate asynchronously.** Creating
  or editing a simulation checks visibility in the application and calls
  `SimulationCalculationService.validate()`: the `InvestmentScenario` rules
  (principal, period, minimum term, curve required, compatible, and not
  deleted) plus `InvestmentCalculator.check()` (supported remuneration,
  business days). Curve coverage is checked only by the calculation. The use
  case then persists the simulation as `PENDING` and raises the event of what
  happened (`SimulationCreated`, `SimulationEdited`, or, for "Tentar
  novamente", `SimulationCalculationRequested`) in the same transaction; the
  calculation consumer handles all of them. Nothing is
  calculated inside the request, so calculation cost is not bounded by
  request timeouts.
- **Calculation is a domain service.** `SimulationCalculationService`
  combines the simulation, its offer and curve, and `InvestmentCalculator`,
  and returns an outcome: `CALCULATED` with a `SimulationResult`, or
  `INVALID` with the reason. Technical failures are thrown, never recorded.
  `Simulation.recordCalculation()` accepts an outcome only for the
  simulation's current revision and owns the state transition.
- **Delivery is the queue's job.** The calculation consumer reads the
  `simulation-calculations` queue, a FIFO queue grouped by simulation, so one
  calculation per simulation is in flight at a time across every worker (see
  "Exclusivity per aggregate" in `messaging.md`). The visibility
  timeout keeps a message with one worker; a worker that dies leaves its
  message to reappear; a failing
  message is retried until `maxReceiveCount` and then dead-lettered; a
  consumer bound to the dead-letter queue sets `FAILED` while the simulation
  is still `PENDING`; `EventDispatcher` skips duplicate deliveries. There are
  no leases, claims, or `CALCULATING` status, and domain code knows nothing
  about queues.
- **Conditional writes.** Edits always overwrite the calculation row with
  `PENDING`, whatever is in flight; fan-out writes no calculation rows (see
  Fan-out). A worker calculates from current
  state, never from the event payload, and its save requires the row to still
  apply to the simulation revision it read; a `FAILED` write also requires the
  row to still be `PENDING`, so a late dead-letter delivery never replaces an
  outcome written meanwhile. Otherwise it discards the outcome and
  acknowledges the message: whatever made its inputs out of date queued its
  own message. The check does not cover the offer and curve revisions, and
  does not need to: a premise change queues a message in the same simulation
  group, which is delivered only after the running calculation finishes and
  then calculates from the latest premises. An outcome from an older premise
  can therefore land, shown "Desatualizado", but it is never the last write.
  Late, duplicate, or concurrent deliveries therefore cannot leave a stale
  state behind.
- **Fan-out** (decided and built 2026-10-26). A splitter in the
  simulations feature: `SimulationRecalculationConsumer` handles the facts
  that affect a calculation (`OfferTermsChanged`, `OfferDeleted`,
  `CurveValuesChanged`, `CurveDeleted`) directly, with no intermediate
  "recalculation requested" event, so offers and curves know nothing about
  simulations. Its use cases (`RecalculateOfferSimulationsUseCase` and
  `RecalculateCurveSimulationsUseCase`, one per premise) read the ids of the
  live simulations that use
  the premise from the repository (`SimulationRepository.findIdsByOffer()` and
  `findIdsByCurve()`, which return arrays) and records one
  `SimulationCalculationRequested` per id through `DomainEventRecorder`, all
  in the consumer's single unit of work: all or nothing, no paging, no
  aggregates loaded, no calculation rows written. The calculation worker
  then handles each request as usual. That transaction grows with the number
  of simulations, a deliberate simplification (see "Fan-out at scale" in
  Deferred Work). While a recalculation is on its way the screen shows the
  derived "Desatualizado", not "Calculando" (see "Recalculation status on
  screen" in Deferred Work). The fan-out queue has a dead-letter queue but
  no consumer bound to it: a dead-lettered fan-out wrote nothing, so its
  simulations stay honestly "Desatualizado" until saved again or until the
  message is redriven, which an alarm on the dead-letter queue should
  prompt.
- **Workers skip current work.** `CalculateSimulationUseCase` returns early,
  acknowledging the message, when the calculation already applies to the
  current inputs: a `CALCULATED` or `INVALID` outcome whose input
  fingerprint equals the current one, including an `INVALID` for a missing
  offer or curve that is still missing. `PENDING` and `FAILED` always
  calculate. Replays, duplicates, and overlapping fan-outs therefore cost one
  read.
- **Deletion requeues like a change.** Deleting an offer or curve fans out
  like a terms or values change; the worker finds the premise missing and
  records `INVALID` with `OFFER_NOT_FOUND` or `CURVE_NOT_FOUND`. Fan-out
  never writes `INVALID` itself: a simulation switched to another premise
  meanwhile is merely recalculated.
- **`INVALID` is scoped to its inputs.** Any change to them queues a new
  calculation.
- **Convergence without a sweep.** The outbox writes each event in the same
  transaction as its change, and SQS redelivers a message until it is handled
  or dead-lettered, so no change is left without a calculation. A methodology
  version change requeues nothing: its results show "Desatualizado" until
  the simulation is saved again.
- **Reads** return the last successful result together with the status, its
  cause, and whether it is settled (`SimulationResultValidity`), so the
  screen can show
  "Calculando" or "Requer ação" over the previous values. The details screen
  polls the same endpoint about every 3 seconds whatever the status; the
  monthly balances refetch only when the result's `calculatedAt` changes. A
  change token with `ETag` and `304` can be added to the same endpoint if
  polling load ever shows up; real-time push is future work.
- An investment plan's status is never stored: `InvestmentPlanStatus`
  derives it at read time from its members (`InvestmentPlanMember`, which
  says whether its result is current), counting
  those in update (`PENDING`), with a pending issue (`INVALID`, `FAILED`),
  and with an outdated result (`CALCULATED` but not current). Outdated is
  kept apart from in update on purpose: a methodology change, a fan-out
  calculation that exhausted its retries, or a deleted offer leaves a result
  stale with nothing queued, and counting it as in update would show the
  plan updating and poll forever. Since fan-out writes no calculation rows,
  members waiting for a premise recalculation count as outdated too (see
  Deferred Work).
