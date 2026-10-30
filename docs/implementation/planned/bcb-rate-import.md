# BCB Rate Import

> **Status: pending, not started.** Its decisions are still open (see
> "Decisions needed first"). Delete this file once it ships and its outcome is
> in [Current State](../current-state.md).

Decided 2026-10-17 (see "Curvas do BCB" in the
[curve specification](../../product/index-value-curves.md)). The system keeps CDI and
effective SELIC curves from the Banco Central (BCB) with the last published
rate kept onwards. In production the BCB curves are the only system curves;
the seeded system curves exist only in the development environment.

It builds on curves holding their last value after their end (built
2026-10-28).

## Decisions needed first

Options discussed 2026-10-28, not yet settled:

- Where the date of the last published value lives so the screens can show
  it, without queueing recalculations. The last interval's end can be that
  date, but today any interval change raises `valuesRevision`, so moving
  only the last end (same value) every day would recalculate every
  simulation on the curve; that rule needs a decision.
- How far back the import loads history, and the schedule's rate.
- How the values reach the backend: a scheduled event consumed by the API,
  which fetches from the last published date (leading option, no Lambda,
  but the fetch runs inside the consumer's transaction); a Lambda that
  publishes the values (cannot resume from the curve's state, and backfill
  chunks are unordered); or a Lambda that calls the API (needs machine
  authentication). See "Hosts" in
  [Messaging Transport](../../architecture/messaging.md); the database never
  accepts connections from outside the backend. The backend applies the
  values, so the rule that adds an interval when the rate changes lives in
  the context.
- How the import runs locally.
- The Banco Central series: the annualized base-252 SGS series of the CDI
  and of the effective SELIC (expected 4389 and 1178; confirm when building).

## Scope

- BCB curves show their source and the date of the last published
  value.
- The backend fetches or receives the published values on the schedule and
  applies them through a curve use case as the system actor. An unchanged
  value extends the last interval's end; a new value adds an interval from
  its date; equal consecutive days form one interval. On business days of
  the product's calendar with no published value it repeats the previous
  value (interim decision), only for days before the latest value published.
  Running it twice for the same day changes nothing.
- A rate change recalculates the simulations using a BCB curve through
  the curve-change fan-out; this happens only when the rate changes (around
  the Copom meetings for the CDI).

## Done when

The BCB CDI and SELIC curves stay current on their own, their screens
show the source and the last published date, and tests cover the import's
no-change, rate-change, missing-day, and repeated runs.
