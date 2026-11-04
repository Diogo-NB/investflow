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
    can poll one outbox, and each row is published by one. The grace period
    is derived from the relay's 2.5 s and the call timeout, so the poller
    leaves a row alone while its relay can still publish it; a lower value
    publishes events twice.
  - **Poll interval.** Decided and built 2026-11-02: the poller backs off
    while it finds nothing, and its process's relay and publisher wake it. It finds work
    only when something went wrong (a failed row is due, the relay dropped
    rows, or another process left rows), so emission volume does not predict
    it: under heavy healthy traffic every poll comes back empty. The
    1-second loop it replaces ran 86,400 claim transactions a day per
    instance on a database shared with other projects, which can go days
    without events.
    - An empty poll doubles the wait, from `OUTBOX_POLL_MIN_INTERVAL_SECONDS`
      (1) up to `OUTBOX_POLL_MAX_INTERVAL_SECONDS` (60): 1, 2, 4 … 32, 60 s,
      the maximum reached about 2 minutes into a quiet period, about 1,440
      polls a day. A poll that claims rows returns to the minimum, and a
      full batch (100) polls again at once. While publishing is paused it
      checks again after the minimum without querying, and keeps the
      interval: a paused poll learned nothing.
    - `OutboxPollSchedule` owns these rules, and the poller waits on it
      after each poll. The relay and the publisher call
      `wakePollerAt(time)` with what they already know: the relay, when it
      leaves rows to the poller (buffer full, stale, or paused), with the
      time they reached it plus the grace period; the publisher, when it
      records failures from either path, with each group's retry time. A
      wake-up brings the next poll forward, never within the minimum of the
      last poll. Later wake-ups wait for later polls, kept at most one per
      minimum interval (the latest of each, so none is served more than the
      minimum late). A rolled-back claim leaves a wake-up that costs one
      empty poll. Neither caller knows the poller, so the dependencies point
      one way, to the schedule.
    - Measured locally with the API idle for 10 minutes: 34 statements on
      the database instead of 1,796 (3 per poll, plus one retention delete).
      `pnpm bench:outbox` showed the relay's loads unchanged; rows past the
      relay buffer of an 8,000-event fan-out published within 5.3 s
      (Floci) and 6.8 s (simulated, bound by claiming 100 rows at a time),
      as before; and a rejected event published 1.0–2.1 s after its
      rejection: its 1 s backoff, plus up to the minimum interval when
      retries spread between polls.
    - Rows of another process (a crash, the seed, a host relying on another
      host's poller) wait up to the maximum interval plus the grace period,
      about 65 s, after a quiet period, then up to 6 s while the poller keeps
      finding them. With one production instance, a crash is followed by a
      restart whose first poll claims them after the grace period.
    - Rejected: backoff alone, which delays retries and relay overflow by up
      to the maximum interval; an interval derived from the local emission
      rate, which tracks traffic rather than the poller's work; and
      a listener the relay calls back on, which made the relay name its
      consumer and split retry wake-ups between the relay and the poller. The
      pattern is active/idle polling (as in Spring Integration's
      `SimpleActiveIdleReceiveMessageAdvice`) with in-process wake-ups, which
      reaches what `LISTEN/NOTIFY` aimed at without its commit lock, because
      the relay runs in the same process.
    - Only the intervals and retention are variables. The grace period,
      batch and payload limits, relay buffer, claim size, retry and pause
      backoff, statement sizes, and shutdown deadline stay constants beside
      their reasons. The 8 concurrent broker calls depend on how many
      instances share the `PutEvents` quota, so revisit them as a variable
      when the API runs on more than one server.
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
- **Logging.** Decided and built 2026-11-03, with Nest's `Logger` and the
  API's `LOG_LEVEL` (default `log`). Lines name an event as
  `<eventType> eventId=… aggregateId=…`, so searching for an event ID
  follows it from commit to handler.
  - `error`: a person must act: publishing paused, an event at the longest
    retry delay, a calculation dead-lettered, a malformed message, an event
    a consumer's queue routes but it has no `@OnEvent` for, or a failed
    receive, poll, or retention run.
  - `warn`: the system recovers by itself: a failed publish below the
    longest delay, events the relay left to the poller, a handler that threw
    (the queue retries it, with its receive count), a failed message delete,
    or a relay that shut down with requests in flight.
  - `log`: rare facts: listeners and the poller starting, publishing
    resumed, rows the poller claimed (it only finds work after the relay
    could not publish), and how many calculations a fan-out requested.
    Empty polls are not logged, so a quiet day stays quiet.
  - `debug`: one line per committed event, published batch, handled or
    duplicate event, and retention batch.

  Postponed: structured JSON output (Nest's
  `ConsoleLogger({ json: true })`) and a tracing setup; a log level was
  enough to follow an event while traffic is low.

- **Retention.** Decided and built 2026-10-28: published rows are kept
  `OUTBOX_RETENTION_DAYS` (7) days, long enough to check when an event went out or to resend it after an
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
    publishing host: 5 minutes after the process starts, and
    `OUTBOX_RETENTION_INTERVAL_SECONDS` (6 hours) after each run ends, it
    deletes batches of 1,000 rows, the oldest first, with
    `FOR UPDATE SKIP LOCKED`, until a batch comes back short. Runs never
    overlap, and shutdown waits for the batch in progress. A batch is one
    short statement (about 8 ms locally), so it locks only its own rows, and
    concurrent instances delete disjoint rows. A 100 ms pause between batches
    spreads a large backlog, such as the first run on an old table, while one
    instance still deletes about 9,000 rows per second, over three times what
    it can publish. Rows expire continuously, so the interval trades idle
    statements against burst size. Since 2026-11-02 it is 6 hours instead of
    5 minutes: 4 runs a day instead of 288, rows kept up to 7 days and 6
    hours, and each run deletes 6 hours of rows, at 100 events per second
    about 2.2 million rows over about 4 minutes.
  - Rejected: deleting rows as they are published, which keeps the table
    minimal but leaves nothing to debug or replay; a daily run, which keeps
    rows up to 8 days and deletes a whole day of rows at once (now a setting
    rather than a code change); a cron
    (`@nestjs/schedule`), which fires every instance at the same moment and
    needs its own overlap and shutdown handling for what one loop does; and
    dropping daily partitions, which needs hand-written migrations because
    Prisma cannot model them, while batched deletes of about 1/7 of the table
    a day leave autovacuum's defaults able to keep up.
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
- **Published index values (decided 2026-11-04).** One Dokploy schedule job per
  index runs `apps/index-values-importer`, at the hour its index is published:
  on the morning after its date, SELIC at 09:00 and CDI at noon. Each
  run fetches new Banco Central values outside
  any transaction, then stores each year's series and records
  `PublishedIndexValuesImported` in one unit of work.
  `PublishedIndexValuesConsumer` applies the event's values to the system curve
  and ignores dates up to its end. It carries values because contexts cannot
  read each other's tables.
  - **Year boundary.** Groups are per aggregate, so a catch-up across a new year
    can run two series of one index in parallel, the one place a curve is not
    protected by FIFO exclusivity. The curve's conditional save makes the loser
    throw and retry, and if January applies first, December's dates are ignored.
  - **No gap check.** A dead-lettered event followed by a later success leaves
    those days on the old rate with no error, and redriving it changes nothing,
    since its dates are then before the curve's end. Accepted because it takes
    five failed deliveries followed by a success, and a check would add a field
    to the series, the event, and the consumer.
- **Hosts.** A host publishes by importing `OutboxModule`, which runs its
  relay, poller, and retention. A host without it, such as the seed, records
  events that a publishing host's poller sends after the grace period. A Lambda
  host would freeze the relay's work after returning, so it would await the
  relay or rely on the poller. Long synchronous work delays the relay like
  any other callback of its process. Consumers run in the API today and can
  become SQS-triggered Lambdas later. The database never accepts connections
  from outside the backend.
  - **The API publishes for every host (decided 2026-11-04, known not to be
    optimal).** It is the only production host importing `OutboxModule`, so
    events recorded by a host without it, such as
    `apps/index-values-importer`, leave the
    outbox only while the API runs, up to about a minute later after a quiet
    period, and the API runs their retention too. A host's publishing should
    not depend on another host's availability and deployments. It is accepted
    because the API is also the only consumer of those events, so its downtime
    would block them anyway, and either alternative costs more today: a host
    publishing its own rows needs a module with only the relay and publisher,
    plus AWS credentials; a dedicated publishing worker loses the relay's
    in-process wake-ups of the poller and adds an always-on process.
    Revisit with the first: when a host other than the API consumes events
    from such a host. Revisit with the second: when publishing has to scale
    apart from the API.
- **Hosting is not tied to AWS.** EventBridge and SQS are public HTTPS APIs. A
  backend on a VPS needs outbound HTTPS to AWS and credentials: a scoped IAM
  user key in the environment, or IAM Roles Anywhere.
- **Production provisioning.** `InvestflowMessagingStack` (AWS CDK, in
  `infra/aws`) creates the bus and each consumer queue with the names,
  patterns, and numbers of `provision.sh`; its spec fails when the two
  differ. It adds a standard `event-delivery-dlq` that keeps the events
  EventBridge fails to deliver to a queue, and the `investflow-api` IAM user,
  which may only publish to the bus and receive and delete messages on the
  queues the API consumes; how it authenticates is in
  [Production Deployment](./deployment.md#aws).
- **Local emulation.** Floci needs no account or auth token, unlike LocalStack
  since its 2026.03 release. `infra/floci/init/provision.sh` runs on every
  container start (Floci keeps state in memory) and creates the bus and each
  consumer queue through `consumer_queue`. The SDK reaches Floci through
  `AWS_ENDPOINT_URL`; no code knows about the emulator. Known gap, verified on
  2026-10-26 with Floci 2.1.0: Floci enforces FIFO groups, but it does not
  evaluate dynamic target paths, so every message of a queue gets the literal
  group `$.detail.aggregateId`. Locally each queue is therefore a single
  group, processed strictly one message at a time: still correct, with no
  parallelism. On AWS the dynamic path is evaluated: verified on 2026-10-31
  against the production queues, where a message's `MessageGroupId` was its
  event's `aggregateId`, so different aggregates are consumed in parallel.
- **Ports.** `MessageBroker` (publishing a batch, reporting the messages the
  broker rejected) and `EventDispatcher` (deduplication
  per consumer, transaction, and `@OnEvent` dispatch) are transport-neutral.
  Only `EventBridgeMessageBroker`, `SqsEventListener`, the provisioning
  script, and the stack know the transport, so replacing it does not touch business code or
  consumers.
