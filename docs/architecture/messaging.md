# Messaging Transport

Decision dated 2026-10-11: integration events travel over Amazon EventBridge
and Amazon SQS, emulated locally by [Floci](https://github.com/floci-io/floci).
This replaces the earlier SNS topic per context.

- **Recording.** Events are recorded in the unit of work, the transaction
  every writing entry point runs in (`UnitOfWork.run()`: HTTP requests,
  consumers, the seed). Aggregates raise them with `apply()` and their
  repository records them on save; domain and application services record
  through the `DomainEventRecorder` port, which bulk work such as fan-out
  uses without loading aggregates. On a unit of work's first event the
  recorder registers two hooks on it: one before commit that writes the
  buffered events to `outbox_events` in chunks of 1,000 rows, so a change and
  its events commit together, and one after commit that hands the rows to
  the outbox relay. Recording outside a unit of work throws.
- **Routing.** The outbox publishes every event to the custom bus
  `investflow` with `source` `investflow.<context>` and `detail-type` set to
  the event type; the `detail` is the serialized domain event. Each consumer
  owns one SQS queue fed by an EventBridge rule on `source` and `detail-type`.
  Publishers never know their consumers, and a new consumer is a new rule.
- **Publishing.** Decided and built 2026-10-27: an event is published right
  after its transaction commits, and a poller is only the fallback. Measured
  locally with `pnpm bench:outbox` against a broker answering in 30 ms, the
  1-second poller this replaces made events wait 5 s on average at 40 events
  per second and up to 116 s in a 3,000-event fan-out; now they wait under
  1 ms at that load and up to 1.1 s in the fan-out.
  - `OutboxRelay` receives a committed unit of work's rows from the
    after-commit hook and publishes them from memory on the next turn of the
    event loop, so the request never waits for the broker and its failure
    never fails the request. It holds at most 5,000 rows, sends nothing a row
    has waited 2.5 s for, and leaves anything it did not mark published to
    the poller. It publishes the rows of its own process, so publishing
    scales with the number of instances.
  - `OutboxPublisher` is the single publishing engine of a process: batches of
    10 messages (and at most 240 KB) per call, at most 8 calls in flight,
    a 2-second timeout per call, and one bulk `UPDATE` to mark rows
    published. Throughput is about calls in flight × 10 / round trip, about
    2,700 events per second per instance at 30 ms. The limit keeps bursts
    within the account's `PutEvents` quota per region (600 requests per
    second in sa-east-1, 10,000 in us-east-1), which every instance shares.
  - `OutboxPollerService` claims due failed rows, and rows older than a grace
    period of 5 s, 100 at a time with `FOR UPDATE SKIP LOCKED`, publishes
    them, and marks them in the claiming transaction. Any number of processes
    can poll one outbox, and each row is published by one. It polls every
    second and again at once while batches come back full. The grace period
    is derived from the relay's 2.5 s and the call timeout, so the poller
    leaves a row alone while its relay can still publish it.
  - An event is published twice only when its process stops between
    publishing and marking it, or its mark fails. Consumers deduplicate by
    event ID. SQS content-based deduplication does not catch these copies:
    every `PutEvents` call gives the envelope a new `id` and `time`.
  - Rejected: waking the poller with PostgreSQL `LISTEN/NOTIFY`. A
    transaction that notifies takes a lock at commit that serializes such
    commits across the whole cluster, held until the commit is flushed, and
    `LISTEN` does not work behind a connection pooler in transaction mode.
    Change data capture (logical replication) would also work, at the cost
    of a replication slot and another service to run. A short poll interval
    alone keeps a floor of half the interval and queries constantly.
- **Unit-of-work hooks.** `UnitOfWorkScope` exposes `beforeCommit` hooks,
  which run inside the transaction and roll it back when they fail, and
  `afterCommit` hooks, which run after a successful commit and outside any
  unit of work. After-commit hooks are best effort: a rollback skips them,
  a stopped process loses them, and their failures are only logged.
  Infrastructure code registers one on the current unit of work with
  `UnitOfWork.afterCommit(hook)`; the outbox and `pnpm bench:outbox` do.
  Hooks are infrastructure: work that must happen after a change is a
  domain event.
- **Exclusivity per aggregate.** Decided and built 2026-10-26: every consumer queue is
  an SQS FIFO queue (`<name>.fifo`, with a FIFO dead-letter queue) with
  content-based deduplication, and its rule target sets
  `SqsParameters.MessageGroupId` to the dynamic path `$.detail.aggregateId`.
  SQS never delivers a second message of a group while one is in flight,
  across every consumer instance, and a failing message holds its group until
  it succeeds or is dead-lettered. Correctness relies on that exclusivity, not
  on delivery order (EventBridge does not guarantee order, and the outbox
  publishes rows of one transaction in no particular order): consumers read
  current state, so the last message of a group always works from the latest
  state. This covers any state derived asynchronously per aggregate, so no
  consumer needs generation counters or a condition per input. Two rules come
  with it:
  - A listener may handle messages of different groups concurrently, but
    messages of one group strictly in the order received.
  - A handler must finish within the visibility timeout, or extend it while
    working; otherwise its message reappears beside it. `EventDispatcher`
    still runs the same event once, but a newer message of the group could
    then run alongside it.
- **Retries.** Every queue has a dead-letter queue. A message that is not
  deleted becomes visible again after the visibility timeout (30 seconds) and is
  dead-lettered after 5 receives. Retry policy is queue configuration, not code.
- **Publishing failures.** A failed event gets an exponential backoff of its
  own (up to 5 minutes, indefinitely), and the poller retries it when due, so
  one bad event never blocks the rest. The broker adapter does not retry
  (`maxAttempts: 1` for EventBridge): the outbox owns the retry policy, and a
  hidden retry could outlast the grace period. Three consecutive failed calls
  pause the relay and the poller together for 1 second. While the broker
  stays down, the first call after each pause fails and starts a pause twice
  as long, up to 60 seconds; a successful call resumes publishing.
- **Retention.** Decided and built 2026-10-28: published rows are kept 7
  days, long enough to check when an event went out or to resend it after an
  incident found days later, and then deleted. Nothing in the code reads
  them: consumers deduplicate in `processed_events`, keyed on the event ID.
  - Two partial indexes split the table, so each row is in one: unpublished
    rows by `created_at`, which the poller claims from, and published rows by
    `published_at`, which retention deletes from. With 1,000,000 published
    rows locally, the claim's index is 16 kB instead of 54 MB, and the claim
    takes 0.2 ms either way: a B-tree already kept the unpublished rows
    together, so the gain is size and cache, not speed. Prisma generates
    them through its `partialIndexes` preview feature.
  - `OutboxRetentionService` is a loop like the poller's, in every
    publishing host: 5 minutes after the process starts, and 5 minutes after
    each run ends, it deletes batches of 1,000 rows, the oldest first, with
    `FOR UPDATE SKIP LOCKED`, until a batch comes back short. Runs never
    overlap, and shutdown waits for the batch in progress. A batch is one
    short statement (about 8 ms locally), so it locks only its own rows, and
    concurrent instances delete disjoint rows. A 100 ms pause between batches
    spreads a large backlog, such as the first run on an old table, while one
    instance still deletes about 9,000 rows per second, over three times what
    it can publish. Rows expire continuously, so the interval only sets how
    many pile up between runs.
  - Rejected: deleting rows as they are published, which keeps the table
    minimal but leaves nothing to debug or replay; a daily run, which keeps
    rows up to 8 days and deletes a whole day of rows at once; a cron
    (`@nestjs/schedule`), which fires every instance at the same moment and
    needs its own overlap and shutdown handling for what one loop does; and
    dropping daily partitions, the answer at a much larger volume, deferred
    because Prisma cannot model them.
  - `processed_events` is kept forever. Its only access is the dispatcher's
    insert, a primary-key lookup whose cost grows with the logarithm of the
    table, and its rows are never updated or deleted, so it leaves autovacuum
    nothing to reclaim. Its cost is storage. Retention would also have to
    outlast the latest a duplicate can arrive (SQS message retention and a
    dead-letter redrive up to 14 days later), not the outbox's 7 days.
- **Payload limit.** The outbox owns a 200 KB payload limit, enforced when the
  event is recorded: events carry identifiers and changed fields, not documents.
  The limit is not derived from the transport; every broker adapter must
  accept payloads of that size (EventBridge accepts 256 KB per entry).
- **Hosts.** A host publishes by importing `OutboxModule`, which runs its
  relay, poller, and retention. A host without it, such as the seed, records
  events that a publishing host's poller sends after the grace period. A Lambda
  host would freeze the relay's work after returning, so it would await the
  relay or rely on the poller. Long synchronous work delays the relay like
  any other callback of its process. Consumers run in the API today and can
  become SQS-triggered Lambdas later. The future index-curve update Lambdas use EventBridge
  Scheduler and deliver data by publishing events or calling the API, so the
  database never needs to accept connections from outside the backend.
- **Hosting is not tied to AWS.** EventBridge and SQS are public HTTPS APIs. A
  backend on a VPS needs outbound HTTPS to AWS and credentials: a scoped IAM
  user key in the environment, or IAM Roles Anywhere.
- **Local emulation.** Floci needs no account or auth token, unlike LocalStack
  since its 2026.03 release. `infra/floci/init/provision.sh` runs on every
  container start (Floci keeps state in memory) and creates the bus and each
  consumer queue through `consumer_queue`. The SDK reaches Floci through
  `AWS_ENDPOINT_URL`; no code knows about the emulator. Known gap, verified on
  2026-10-26 with Floci 2.1.0: Floci enforces FIFO groups, but it does not
  evaluate dynamic target paths, so every message of a queue gets the literal
  group `$.detail.aggregateId`. Locally each queue is therefore a single
  group, processed strictly one message at a time: still correct, with no
  parallelism. Dynamic paths on rule targets are documented by AWS but not yet
  verified on real infrastructure; verify them in a homolog environment
  before relying on parallel consumers. If the path were not evaluated, AWS
  would behave like Floci: serial, never incorrect.
- **Ports.** `MessageBroker` (publishing a batch, reporting the messages the
  broker rejected) and `EventDispatcher` (deduplication
  per consumer, transaction, and `@OnEvent` dispatch) are transport-neutral.
  Only `EventBridgeMessageBroker`, `SqsEventListener`, and the provisioning
  script know the transport, so replacing it does not touch business code or
  consumers.
