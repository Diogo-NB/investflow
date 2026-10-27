---
name: investflow-outbox-benchmark
description: Run, interpret, and report InvestFlow's outbox publishing benchmark (`pnpm bench:outbox`), which measures how long committed domain events wait before they are published. Use when asked to benchmark or measure event publishing latency or throughput, to compare before and after a change to the outbox, relay, poller, publisher, broker adapter, or unit of work, to investigate slow event delivery, or to extend the benchmark tool. Do not use for consumer-side latency (SQS to handler) or HTTP load testing.
---

# InvestFlow Outbox Benchmark

`pnpm bench:outbox` drives the real `UnitOfWork`, `DomainEventRecorder`,
`OutboxRelay`, `OutboxPublisher`, and `OutboxPollerService` in-process. It
replaces only the `MessageBroker` with a timing wrapper around Floci or a
simulated broker. Its events use the context `benchmark`, which no
EventBridge rule matches, so nothing reaches a queue. It deletes its rows
before and after a run. How publishing works is in "Messaging Transport" in
`docs/architecture/project-structure.md`; use `investflow-eventing` to change
it.

## Before running

1. Load Node: `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use`.
2. PostgreSQL must be running, plus Floci for `--broker floci` (`pnpm db:up`).
   If Docker is unavailable, ask the user to start it; do not work around it.
3. **The API must be stopped.** Its poller would publish the benchmark's rows
   itself, and the loads would end `TIMED OUT`. Check with
   `ss -ltnp | grep ':3000\b'`, and ask the user before stopping a process
   you did not start.
4. The outbox must be drained. The tool refuses to run while other events are
   unpublished. The fix is to start the API until they publish, then stop it;
   ask the user rather than deleting rows.
5. It uses `DATABASE_URL` from `.env` (the local database).

## Options

All flags are optional; defaults are in parentheses. `--help` prints the same list.

| Flag                            | Meaning                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--broker floci\|simulated`     | `floci`: real `EventBridgeMessageBroker` against Floci (~1 ms per call), so it isolates the outbox's own pickup delay. `simulated`: sleeps `--rtt-ms` ±30% per call, closer to AWS, so it also shows throughput limits (`simulated`) |
| `--rtt-ms <n>`                  | Simulated round trip per call, in ms (30)                                                                                                                                                                                            |
| `--loads <list>`                | Any of `steady,concurrent,fanout`, run in that order (all)                                                                                                                                                                           |
| `--rate <n>`                    | steady: transactions per second, with exponential gaps like independent users (20)                                                                                                                                                   |
| `--events-min/--events-max <n>` | steady: events per transaction, uniform (1/3)                                                                                                                                                                                        |
| `--duration-s <n>`              | steady: seconds of traffic (15)                                                                                                                                                                                                      |
| `--transactions <n>`            | concurrent: single-event transactions (500)                                                                                                                                                                                          |
| `--parallel <n>`                | concurrent: transactions in flight, at most the pool size of 10 (10)                                                                                                                                                                 |
| `--events <n>`                  | fanout: events recorded in one transaction, like a premise fan-out (3000)                                                                                                                                                            |
| `--idle-s <n>`                  | Whole seconds to measure idle database use before the loads (3)                                                                                                                                                                      |
| `--timeout-s <n>`               | Seconds to wait for a load to be published before reporting `TIMED OUT` (300)                                                                                                                                                        |

A full default run takes about 1 minute per broker. Code that publishes
slowly takes longer: the old 1-second poller needed about 2.5 minutes for the
simulated fan-out alone. Run commands with a timeout of at least 10 minutes,
and save each output: `pnpm -s bench:outbox ... 2>&1 | grep -v dotenv | tee <scratchpad>/<name>.txt`.

## Recipes

- **Standard measurement:** run `--broker floci`, then `--broker simulated`.
  Floci shows the pickup delay the design adds; simulated shows how it holds
  up with realistic round trips.
- **Before and after a change:** record both brokers on the unchanged code
  first, then again after the change, with identical flags. If the baseline
  needs another commit, ask the user how to get it; never stash or reset
  their work.
- **Smoke test** (about 10 s): `--broker floci --duration-s 3 --transactions 100 --events 500 --idle-s 1`.
- **Find the saturation point:** repeat `--loads steady` with a rising
  `--rate` (20, 50, 100, 200) and `--events-max`. Publishing keeps up while
  drain ≈ duration; latency explodes after the point where it does not.
- **Relay limits:** a fan-out above 5,000 events exceeds the relay buffer, so
  the excess waits for the poller's 5 s grace period: expect two clusters
  of pickup times. `--rtt-ms 100` shows how throughput scales down with a
  slower broker.

## Reading the output

The header names the broker, idle database calls per second, and the
definitions. One row per load:

| Column                          | Meaning                                                                         | Healthy today (2026-10-27, local)                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pickup avg/p50/p95/p99/max (ms) | COMMIT acknowledged → first publish call, per event. The headline metric        | steady under 1 ms on both brokers; concurrent max ~5 ms (Floci) / ~12 ms (simulated); fan-out max ~185 ms / ~1.1 s                                                                         |
| Drain (s)                       | Load start → last event accepted                                                | steady ≈ `--duration-s`; concurrent ~0.4 s; fan-out ~0.5 s / ~1.4 s                                                                                                                        |
| Publish calls                   | `PutEvents` calls for the load                                                  | well below the event count (up to 10 events per call)                                                                                                                                      |
| run() p50/p99 (ms)              | `UnitOfWork.run()` per transaction, which is what a request pays                | about 2–3 ms steady; concurrent p50 ~6–9 ms and p99 ~20–30 ms, because 10 writers in flight hold all 10 pool connections and the rest wait for one; fan-out ~300 ms (inserting 3,000 rows) |
| After commit p99 (µs)           | COMMIT acknowledged → `run()` resolved: work on the request's path after commit | tens to low hundreds of µs                                                                                                                                                                 |
| Published                       | `all`, or `TIMED OUT` (exit code 1)                                             | `all`                                                                                                                                                                                      |

Idle should be about 1.0 database calls/s: one poll per second.

Before the relay (the 1-second poller only), the same simulated loads
waited up to 9.8 s (steady), 18.5 s (concurrent), and 115.7 s (fan-out).

**Red flags:**

- Steady pickup p50 in the hundreds of ms, or max near 1,000 ms: the relay
  is not publishing, and events wait for the poller.
- Pickup max near 5,000 ms: rows waited the grace period. The relay
  dropped them (buffer over 5,000 rows, rows older than 2.5 s, or paused).
- Steady drain well beyond `--duration-s`, or pickup growing over the run:
  publishing does not keep up with the rate.
- Publish calls ≈ events: batching is broken.
- After commit in milliseconds: something heavy moved onto the request path.
- Idle well above 1/s: the poller loop is spinning.
- `TIMED OUT`: the API was running, the broker rejected events (look for
  `OutboxPublisher` warnings in the output), or `--timeout-s` was too short
  for the code under test.

**Limits:**

- Results are per-machine. Compare runs from the same machine and session,
  and rerun when a difference is under about 20%. Compare p50 and p99, not
  max alone.
- A fan-out is one transaction, so its `run()` columns have one sample.
- The simulated broker models round trips, not EventBridge quotas or
  throttling.
- Neither broker includes EventBridge → SQS → consumer delivery, which AWS
  reports at about 130 ms p99, ingestion to invocation.

## Reporting results

Readers should understand the outcome without decoding the raw table.

1. **Context first:** the commit or change, broker and `--rtt-ms`, any flags
   that differ from the defaults, and that results are local.
2. **One table per broker**, with a unit in every header and thousands
   separators. Write "6,115 ms (about 6.1 s)" the first time a value passes
   1,000 ms. With a baseline, compare before and after:

   | Load | Before avg (ms) | After avg (ms) | Before p99 (ms) | After p99 (ms) | Before max (ms) | After max (ms) | Drain before → after (s) |
   | ---- | --------------- | -------------- | --------------- | -------------- | --------------- | -------------- | ------------------------ |

   For a single run, show it against the healthy ranges above:

   | Load | Pickup avg (ms) | Pickup p99 (ms) | Pickup max (ms) | Drain (s) | Publish calls | Healthy? |
   | ---- | --------------- | --------------- | --------------- | --------- | ------------- | -------- |

3. **One sentence per load in plain words**, for example: "Under steady
   traffic, events now wait at most 0.7 ms instead of 9.8 s."
4. **Request-side cost:** `run()` and after-commit, before and after when
   there is a baseline, and whether they moved beyond noise. Without one,
   report the measured values ("under 150 µs after commit") and compare them
   with the healthy ranges; do not claim the change adds "nothing", because
   there is no run without it to compare against.
5. **Caveats:** anything a red flag or limit above touches, and what was not
   measured.
6. Keep the raw outputs (paths, or attached in the PR description) so the
   numbers can be checked.

Never present numbers without units, and never call a change an
improvement from a single run that differs by less than about 20%.

## Changing the tool

The tool is `tools/benchmarks/outbox-latency.ts` (composition, measurement,
`main()`), with modules in `tools/benchmarks/outbox-latency/`:

| File                      | Owns                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `benchmark-options.ts`    | Flags, validation, typed `BenchmarkOptions`, usage text                |
| `loads.ts`                | Load definitions: add a name to `loadNames` and a case in `createLoad` |
| `timed-message-broker.ts` | Broker wrapper and per-event timings                                   |
| `report.ts`               | `Summary`, `LoadResult`, and the report columns, each defined once     |

It is the `tools` Nx project, so `pnpm check` lints and typechecks it. It
follows the `tools/` conventions in `AGENTS.md`: typed options, named results,
no import-time side effects, and public APIs instead of patches (it marks
the commit through `UnitOfWork.afterCommit()`). After a change to the tool,
run the smoke test and a full run on both brokers. Confirm the numbers match
the previous ones before trusting them, then update this skill's healthy
ranges if the code under test changed.
