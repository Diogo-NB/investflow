# Fan-out at Scale

> **Status: pending, not started.** Its design is still open (see
> "Decisions needed first"). Delete this file once it ships and its outcome is
> in [Current State](../current-state.md).

Deferred 2026-10-26, moved to the backlog 2026-10-29. It changes the fan-out
described in [Recalculation](../../architecture/recalculation.md) and the
publishing path in [Messaging Transport](../../architecture/messaging.md).

## Today

Fan-out records every `SimulationCalculationRequested` for a premise in one
unit of work. A system curve used by hundreds of thousands of simulations
would need one very large transaction, which could outlast the 30-second
visibility timeout and be dead-lettered. Publishing is batched (about 2,700
events per second per instance at a 30 ms round trip, bounded by the
`PutEvents` quota), but the relay takes at most 5,000 rows of a burst; the
poller publishes the rest after the grace period, 100 rows per claim.

## Decisions needed first

- How fan-out records through the outbox in bounded chunks: a dispatcher
  mode whose handler opens its own units of work, ids streamed from the
  repository, and a visibility heartbeat (the starting proposal, not yet
  designed).
- How listeners handle different message groups concurrently.
- Whether publishing keeps up with a large burst, measured with
  `pnpm bench:outbox`.

## Done when

A premise reaching any number of simulations fans out in bounded
transactions within the visibility timeout, and publishing keeps up.
