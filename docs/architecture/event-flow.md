# Event Flow

A visual guide to how events move through InvestFlow, and how a simulation's
result is recalculated when anything it depends on changes. Read this first;
the rules behind it are in "Messaging Transport" and "Mutable Premises And
Asynchronous Recalculation" in [Project Structure](./project-structure.md).

> **Status.** The event transport (outbox, EventBridge, SQS, consumers) and a
> simulation's own asynchronous calculation (D4a) are built, on FIFO queues
> grouped per aggregate. Recalculation after offer and curve changes (D4b,
> walkthroughs 5 and 6) is designed but not built; see the
> [roadmap](../product/implementation-roadmap.md).

## In One Picture

```mermaid
flowchart LR
  subgraph request["API request (one transaction)"]
    UC["Use case"] --> SAVE[("Postgres: aggregate + outbox row")]
  end
  SAVE --> POLL["Outbox poller (every second)"]
  POLL --> BUS{{"EventBridge bus 'investflow'"}}
  BUS -- "rule per consumer" --> Q[["SQS queue"]]
  Q --> C["Consumer → use case"]
  C --> DB[("Postgres")]
  Q -. "5 failed receives" .-> DLQ[["Dead-letter queue"]]
```

Three ideas carry the whole design:

1. **A change and its event are saved together.** The event goes into an
   `outbox_events` row in the same transaction as the change, so there is
   never a change without its event, or an event without its change.
2. **The queue does the delivery work.** SQS hands a message to one worker at
   a time, gives it to another if that worker dies, retries failures, and
   gives up into a dead-letter queue. Queues are FIFO and grouped by the
   event's aggregate, so one message per aggregate (one calculation per
   simulation) is in flight at a time across every worker. Our code never
   counts retries or holds locks.
3. **Consumers read current state.** Events carry identifiers only. A consumer
   loads what it needs from the database, so a late or duplicate event can
   never apply stale data.

## Vocabulary

| Term               | What it is                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Domain event       | A past-tense fact, such as `OfferTermsChanged`. Carries identifiers, never values.                           |
| Unit of work       | `UnitOfWork.run()`: the transaction of a request or consumer. Its recorded events are written with it.       |
| Recorder           | `DomainEventRecorder`: records events in the unit of work. Repositories use it on save; services directly.   |
| Outbox             | The `outbox_events` table. Events wait here until published.                                                 |
| Outbox poller      | `OutboxPollerService`. Publishes unpublished rows every second and backs off per event on failure.           |
| Bus                | The EventBridge bus `investflow`. Publishers send every event here and know nothing about consumers.         |
| Rule               | An EventBridge rule that copies matching events (by `source` and `detail-type`) into one consumer's queue.   |
| Queue              | One SQS FIFO queue per consumer, created by `consumer_queue` in `infra/floci/init/provision.sh`.             |
| Message group      | The event's `aggregateId`. SQS delivers a group's next message only after the current one is deleted.        |
| Visibility timeout | 30 seconds during which a received message is hidden from other workers. If it is not deleted, it reappears. |
| Dead-letter queue  | Where SQS moves a message after 5 failed receives. Every consumer queue has one.                             |
| Consumer           | A plain class with `@OnEvent('EventType')` methods that call a use case. Knows nothing about SQS.            |
| `EventDispatcher`  | Runs a consumer's handler in a transaction together with a `processed_events` row, so duplicates run once.   |
| Floci              | The local emulator of EventBridge and SQS used by `pnpm db:up`.                                              |

## Part 1: How Any Event Travels

```mermaid
sequenceDiagram
  autonumber
  participant UC as Use case
  participant DB as Postgres
  participant P as Outbox poller
  participant EB as EventBridge
  participant Q as SQS queue
  participant L as SqsEventListener
  participant C as Consumer

  UC->>DB: save aggregate, record its event (one unit of work)
  Note over UC,DB: before commit, the unit of work writes the outbox rows
  P->>DB: fetch unpublished rows
  P->>EB: PutEvents (source, detail-type, detail)
  P->>DB: mark row published
  EB-->>Q: rule matches, message enqueued
  L->>Q: long-poll receive (message hidden 30 s)
  L->>C: EventDispatcher.dispatch
  Note over C,DB: one transaction: insert processed_events row, run handler
  C->>DB: handler writes its effects, commit
  L->>Q: delete message
```

### What if something fails?

| What fails                           | What happens                                                                               | Who handles it     |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------ |
| The request's transaction rolls back | Neither the change nor the event exists.                                                   | Outbox             |
| EventBridge rejects or is down       | The row stays unpublished and is retried with backoff; the poller pauses during an outage. | Outbox poller      |
| The poller crashes after publishing  | The row is published again; the consumer skips the duplicate.                              | `EventDispatcher`  |
| SQS delivers a message twice         | The second `processed_events` insert finds the first one and the handler is skipped.       | `EventDispatcher`  |
| The handler throws                   | The transaction rolls back, the message is not deleted, and it reappears after 30 seconds. | SQS                |
| The worker process dies mid-handler  | Same as a throw: the open transaction rolls back and the message reappears.                | SQS and Postgres   |
| The handler fails 5 times            | SQS moves the message to the dead-letter queue.                                            | SQS                |
| The message body is malformed        | It is not deleted, so it ends in the dead-letter queue after 5 receives.                   | `SqsEventListener` |

## Part 2: Simulation Recalculation

A simulation references an offer and, for indexed remuneration, a curve.
Offers and curves are editable, so a simulation's result must follow them.
Saving returns immediately and the result arrives a moment later.

### Statuses

```mermaid
stateDiagram-v2
  [*] --> PENDING: created
  PENDING --> CALCULATED: worker saved the result
  PENDING --> INVALID: a business rule blocks it, or the offer or curve was deleted
  PENDING --> FAILED: retries exhausted
  CALCULATED --> PENDING: edited or premise changed
  INVALID --> PENDING: edited or premise changed
  FAILED --> PENDING: Tentar novamente or edited
```

| Status       | Screen shows                                                    | Who acts                   |
| ------------ | --------------------------------------------------------------- | -------------------------- |
| `PENDING`    | "Calculando" with its cause, over the last result marked as old | System                     |
| `CALCULATED` | "Atualizado" with the current result                            | Nobody                     |
| `INVALID`    | "Requer ação" with the reason and the change that led to it     | User                       |
| `FAILED`     | "Falha técnica" with "Tentar novamente"                         | System; the user can retry |

There is deliberately no "calculating" status. While a worker holds a
message, the simulation is simply `PENDING`; storing more would need leases
that a crashed worker could leave behind.

### The Calculation Record

Each simulation has one row in `simulation_calculation`, next to its
`simulation_result`. It is part of the `Simulation` aggregate as the
`SimulationCalculation` value object.

| Field                                                                  | Holds                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `status`                                                               | `PENDING`, `CALCULATED`, `INVALID`, or `FAILED`                                                                           |
| `changed_at`                                                           | When it entered this status                                                                                               |
| `cause_kind`                                                           | Why it was last queued (list below)                                                                                       |
| `cause_actor_id`                                                       | Who made the change; `null` for system processes                                                                          |
| `simulation_revision`, `offer_terms_revision`, `curve_values_revision` | The inputs this status applies to: the simulation revision, the offer's `termsRevision`, and the curve's `valuesRevision` |
| `reason_code`, `reason_metadata`                                       | Only for `INVALID`: the stable error code and details, such as uncovered periods                                          |

Causes: `CREATED`, `SIMULATION_EDITED`, `METHODOLOGY_CHANGED`,
`RETRY_REQUESTED`. D4b removes `OFFER_CHANGED`, `OFFER_DELETED`,
`CURVE_CHANGED`, `CURVE_DELETED`, and `cause_ref_id`: fan-out writes no
calculation rows, so nothing would set them.

The cause is set when the simulation is queued, and the worker keeps it when
it writes the outcome. "The worker did it" explains nothing; "the
simulation was edited" does:

```mermaid
flowchart LR
  E["Simulation edited"] --> P["PENDING · SIMULATION_EDITED"]
  P --> I["INVALID · COVERAGE_MISSING · cause kept"]
```

Only the current state is kept. A status history is listed under "Deferred
Work" in [Project Structure](./project-structure.md).

### Who Does What

| Layer          | Piece                                       | Responsibility                                                                                                                                                         |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain         | `Simulation`                                | Sets `PENDING` with a cause and raises `SimulationCreated`, `SimulationEdited`, or `SimulationCalculationRequested`; accepts an outcome only for its current revision. |
| Domain         | `SimulationCalculationService`              | `validate()`: the rules checked in the request. `calculate()`: a `CALCULATED` or `INVALID` outcome; throws on technical failure.                                       |
| Domain         | `InvestmentCalculator`                      | `check()`: supported remuneration and business days. `calculate()`: the numbers, including curve coverage.                                                             |
| Application    | Create, edit, retry use cases               | Check visibility, validate, save.                                                                                                                                      |
| Application    | `CalculateSimulationUseCase`                | Load current state, calculate, record, save; a conflict is a discard.                                                                                                  |
| Infrastructure | `SimulationCalculationConsumer`             | One `@OnEvent` per event above, all calculating; throws on technical failure so SQS retries.                                                                           |
| Infrastructure | Dead-letter consumer                        | Sets `FAILED` while the simulation is still `PENDING`.                                                                                                                 |
| Infrastructure | Repository                                  | Conditional update of `simulation_calculation` on the revisions read.                                                                                                  |
| SQS            | `simulation-calculations` queue and its DLQ | One worker per message, redelivery, retries, giving up.                                                                                                                |

### Walkthrough 1: Saving a Simulation

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant DB as Postgres
  participant Q as SQS
  participant W as Worker

  B->>A: PATCH /simulations/:id (revision 2)
  A->>A: SimulationCalculationService.validate()
  Note over A: a broken rule returns 4xx on its field and saves nothing
  A->>DB: revision 3, PENDING (SIMULATION_EDITED, this user), SimulationEdited in the outbox
  A-->>B: 200 with the new revision (calculation PENDING)
  DB-->>Q: outbox poller and EventBridge deliver the event
  Q-->>W: receive (hidden from other workers for 30 s)
  W->>DB: processed_events row, load simulation, offer, curve
  W->>W: calculate in memory
  W->>DB: save CALCULATED where simulation_revision = 3
  W->>Q: delete message
  B->>A: next poll returns CALCULATED
```

Every rule except curve coverage is checked in the request: principal,
period, minimum term, curve required, compatible and not deleted, supported
remuneration, and business days. Coverage needs the whole calculation, so
only the worker finds it.

### Walkthrough 2: Saving Again During a Calculation

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant DB as Postgres
  participant Q as SQS
  participant W as Worker

  Q-->>W: receive m1 (for revision 3)
  W->>DB: load revision 3
  B->>A: PATCH (revision 3)
  A->>DB: revision 4, PENDING, SimulationEdited m2 in the outbox
  W->>DB: save where simulation_revision = 3
  DB-->>W: 0 rows: the row now applies to revision 4
  W->>Q: discard the outcome, delete m1
  Q-->>W: receive m2 (for revision 4)
  W->>DB: save CALCULATED for revision 4
```

Edits always win. The losing worker returns normally, because whatever made
its inputs out of date queued its own message.

### Walkthrough 3: A Business Rule Blocks the Calculation

The worker finds that the curve has no values for part of the period. That is
an outcome, not an error: it saves `INVALID` with `INVESTMENT_CURVE_COVERAGE_MISSING`
and the uncovered periods, keeps the last successful result and the cause,
and deletes the message. Retrying would give the same answer. Editing the
simulation or the curve queues it again.

### Walkthrough 4: Technical Failure

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant DB as Postgres
  participant Q as SQS
  participant W as Worker
  participant D as DLQ consumer

  Q-->>W: receive m1
  W->>W: throws (for example a database timeout)
  Note over Q,W: not deleted, reappears after 30 s, fails 4 more times
  Q-->>D: 5th failure moves m1 to the dead-letter queue
  D->>DB: markCalculationFailed() while still PENDING
  B->>A: poll returns FAILED ("Falha técnica")
  B->>A: POST /simulations/:id/recalculate (Tentar novamente)
  A->>DB: PENDING (RETRY_REQUESTED), SimulationCalculationRequested in the outbox
```

The dead-letter consumer writes `FAILED` only while the row is still
`PENDING` for the revision it read, so it never replaces an outcome written
meanwhile. If a newer message for the same revision is already in flight (a
retry, or saving without changes), the screen may show "Falha técnica" briefly
before that calculation replaces it.

### Walkthrough 5: An Offer's Terms or a Curve's Values Change (D4b)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant DB as Postgres
  participant Q as SQS
  participant F as Fan-out consumer
  participant W as Worker

  B->>A: PATCH /offers/:id (new rate)
  A->>DB: offer termsRevision 4, OfferTermsChanged (offer id) in the outbox
  DB-->>Q: delivered to the fan-out queue (group: offer id)
  Q-->>F: receive OfferTermsChanged
  F->>DB: one transaction: read the ids of the simulations using the offer, one SimulationCalculationRequested each
  DB-->>Q: N calculation messages (group: simulation id)
  Q-->>W: same worker as walkthrough 1, after any calculation of the simulation already running
  W->>DB: skips if already current, else calculates from offer termsRevision 4
```

Only facts that affect a calculation fan out: `OfferTermsChanged`,
`OfferDeleted`, `CurveValuesChanged`, and `CurveDeleted`. Renaming an offer or
describing a curve (`OfferDetailsChanged`, `CurveDetailsChanged`) reaches no
consumer and leaves its simulations up to date. Fan-out never loads
simulations and writes no calculation rows: until each result lands, the
screen shows "Desatualizado", derived from the term revisions. It records
all its requests in one transaction, a simplification listed under
"Fan-out at scale" in the Deferred Work of
[Project Structure](./project-structure.md).

### Walkthrough 6: An Offer or Curve Is Deleted (D4b)

Deletion goes through the same path as walkthrough 5. The worker finds the
premise missing and records `INVALID` with the reason ("Sem oferta, escolha
outra" or "Sem curva, escolha outra"). Fan-out never writes `INVALID`
itself: if a user switched a simulation to another premise meanwhile, the
worker merely recalculates it from the new one. Choosing another offer or
curve is an edit, which queues a calculation.

### The Guard: Three Rules

1. **Edits always win.** User edits and fan-out set `PENDING` without looking
   at the calculation state.
2. **Workers write only if still current.** The save requires the
   calculation row to still apply to the simulation revision the worker read.
3. **Losing is harmless.** A worker that loses discards its outcome and
   acknowledges the message; the newer change already queued a newer
   calculation.

The guard does not check the offer and curve revisions. It does not need to:
messages are grouped by simulation, so the calculation queued by a premise
change waits for the running one and then reads the latest premises. An
outcome from an older premise may land first and show "Desatualizado" for a
moment, but it is never the last write.

### When Things Go Wrong

| Situation                                | Outcome                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| The same message arrives twice           | `processed_events` runs it once.                                               |
| Two messages for one simulation          | Their group delivers them one after the other; the second reads current state. |
| The user edits during a calculation      | The old outcome is discarded; the new message calculates.                      |
| The premise changes during a calculation | The old outcome may land; fan-out's message (D4b) runs next and replaces it.   |
| A worker dies mid-calculation            | The message reappears after 30 seconds and another worker takes it.            |
| A technical error keeps happening        | After 5 receives the message is dead-lettered and the status is `FAILED`.      |
| A business rule fails                    | `INVALID` with the reason, recorded once and never retried.                    |
| The simulation was deleted               | The worker finds nothing to calculate and acknowledges the message.            |

## How the Screen Stays Current

The simulation's page polls its details endpoint about every 3 seconds,
whatever the status. The response is small, so there is no change token and
no extra endpoint.

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API

  loop every ~3 s while the tab is visible
    B->>A: GET simulation details
    A-->>B: status, cause, last result summary
  end
  Note over B: a new calculatedAt changes the balances query key
  B->>A: GET monthly-balances (once per new result)
```

- Polling pauses while the tab is hidden and refetches on focus (TanStack
  Query defaults).
- A refetch updates the status and result panels, never the form: the editor
  keeps the revision it was loaded or last saved at (`PATCH` answers the new
  one) and sends it, so a change made elsewhere is a `409` on save. When a
  poll shows a newer revision, the screen offers to reload.
- If polling load ever shows up, an `ETag` with `304` can be added to the same
  endpoint without client changes. Real-time push is future work.

## Where the Code Lives

| Piece                                           | Path                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| Outbox writer and poller, broker port, recorder | `libs/shared/infrastructure/src/lib/messaging/outbox`                    |
| `UnitOfWork`                                    | `libs/shared/infrastructure/src/lib/persistence`                         |
| EventBridge adapter                             | `libs/shared/infrastructure/src/lib/messaging/eventbridge`               |
| `EventDispatcher`, `@OnEvent`                   | `libs/shared/infrastructure/src/lib/messaging/consumers`                 |
| `SqsEventListener`, `SqsConsumersModule`        | `libs/shared/infrastructure/src/lib/messaging/sqs`                       |
| Queues, rules, dead-letter queues               | `infra/floci/init/provision.sh`                                          |
| Offer and curve events                          | `libs/investment-simulator/domain/src/lib/offers`, `.../curves`          |
| Simulation, calculation service                 | `libs/investment-simulator/domain/src/lib/simulations`                   |
| Calculation, failure, and retry use cases       | `libs/investment-simulator/application/src/lib/simulations`              |
| Calculation and dead-letter consumers           | `libs/investment-simulator/infrastructure/src/lib/simulations/messaging` |

## Adding a New Consumer

1. Write the consumer in the owning context's infrastructure: an
   `@Injectable()` class with one `@OnEvent('EventType')` method per event,
   each calling a use case. Class names must be unique.
2. Add `consumer_queue <name> '<event pattern>'` to
   `infra/floci/init/provision.sh`. It creates the FIFO queue, its FIFO
   dead-letter queue, and the rule, whose target groups messages by
   `$.detail.aggregateId`.
3. Add the queue URL to `.env.example` and bind the consumer in the host
   with `SqsConsumersModule.register([{ consumer, queueUrlConfigKey }])`.
4. Make the effect idempotent and read current state. Throw only for failures
   a retry can fix; return normally when the work is no longer needed.
5. Test the use case directly; `messaging.integration.spec.ts` covers the
   transport end to end against Floci.

## Related Docs

- [Project Structure](./project-structure.md): "Messaging Transport" and
  "Mutable Premises And Asynchronous Recalculation".
- [Implementation Roadmap](../product/implementation-roadmap.md): D4a and
  D4b scope.
- [PRD](../product/investment-simulator-prd.md): "Modelo de Atualização" and
  "Cálculos de Simulação".
- `$investflow-eventing`: rules for publishing and consuming.
