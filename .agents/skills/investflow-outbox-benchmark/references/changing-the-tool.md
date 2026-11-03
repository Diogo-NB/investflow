# Changing the Benchmark Tool

The tool is `tools/benchmarks/outbox-latency.ts` (composition, measurement,
`main()`), with modules in `tools/benchmarks/outbox-latency/`:

| File                        | Owns                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| `benchmark-options.ts`      | Flags, validation, typed `BenchmarkOptions`, usage text                |
| `loads.ts`                  | Load definitions: add a name to `loadNames` and a case in `createLoad` |
| `timed-message-broker.ts`   | Broker wrapper, simulated rejections, and per-event timings            |
| `observed-outbox-poller.ts` | `OutboxPollerService` subclass recording each poll's time and claims   |
| `report.ts`                 | `Summary`, `LoadResult`, and the report columns, each defined once     |

It is the `tools` Nx project, so `pnpm check` lints and typechecks it. It
follows the `tools/` conventions in `AGENTS.md`: typed options, named results,
no import-time side effects, and public APIs instead of patches (it marks
the commit through `UnitOfWork.afterCommit()`, swaps the poller with
`overrideProvider(OutboxPollerService).useClass(...)` and observes its
public `drainOnce()`, and commits the `stranded` load through a second
testing module without `OutboxModule`). After a change to the tool,
run the smoke test and a full run on both brokers. Confirm the numbers match
the previous ones before trusting them, then update this skill's healthy
ranges if the code under test changed.
