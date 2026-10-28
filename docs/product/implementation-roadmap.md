# Implementation Roadmap

Delivery plan for the investment simulator. Product rules are in the
[PRD](./investment-simulator-prd.md) and the
[curve specification](./index-value-curves.md); the architecture is in
[docs/architecture](../architecture/); screen behavior is in
[screens](./screens/); what is built is in [Current State](./current-state.md).

The mutable-premises redesign (decided 2026-10-11, D0 to D6) has shipped,
D4b last (2026-10-26). This plan adds the next features: side-by-side
simulation comparison, investment plans with their totals, and the index
curves observed from the Banco Central with their kept rate.

Each deliverable is one pull request. Every pull request keeps `pnpm check`
green and the app working end to end: a backend change also adapts the screens
that consume it, so `main` is never half migrated. The local database is
disposable, so schema changes reset it with `pnpm db:setup` instead of
migrating existing rows.

> **Keep this document current.** Update it in the same pull request that
> changes what it describes: the current state, the next steps, a
> deliverable's status, scope or done criteria, and any decision that reorders
> the plan. Remove a deliverable's detail section once it ships and its
> outcome is reflected in [Current State](./current-state.md).

## Current State

Last updated 2026-10-28. D0 to D10, D4b, and D12a are done: offer and curve
changes recalculate the simulations that use them, over FIFO queues grouped
per aggregate, and investment plans group the simulations a user would invest
in together, with their totals, maturity schedule, and liquidity. Events are
now published right after their transaction commits. After a curve's last
end its last value holds onwards, so unmatured offers can be simulated.

What is built, area by area, and where it differs from the target model
is in [Current State](./current-state.md).

Not started and outside this roadmap: IPCA calculation, early redemption, the
requeue after a methodology version change, and the "saldo hoje" balance,
which needs product refinement and a domain concept of its own (see
[Deferred Work](../architecture/deferred-work.md) and the
PRD's "Pendências de Produto").

## Next Steps

1. Settle D12b's decisions before D12b.

## Overview

| #    | Deliverable                                                       | Depends on           | Status      |
| ---- | ----------------------------------------------------------------- | -------------------- | ----------- |
| D4b  | Offer and curve changes recalculate the simulations that use them | D4a                  | Done        |
| D7   | Simulation return rates and remaining term                        | —                    | Done        |
| D8   | Side-by-side simulation comparison                                | D7                   | Done        |
| D9   | Investment plans: management, membership, and derived status      | —                    | Done        |
| D10  | Investment plan totals, maturity schedule, and liquidity          | D9                   | Done        |
| D12a | Curves hold their last value after their end                      | —                    | Done        |
| D12b | Observed system curves from the Banco Central                     | D12a, D12b decisions | Not started |

```text
D7                      ──► D8
D9                      ──► D10
D4a                     ──► D4b
D12a + (D12b decisions) ──► D12b
```

Recommended order: D12b once its decisions are settled.

D11 (investment plan comparison) was dropped on 2026-10-28: judging which
plan is better is outside the project's scope, and a plan has no return rate
of its own (PRD "Totais do Plano"). D13 (an interim "Hoje" marker on the
balance chart) was dropped the same day as a product decision; "saldo hoje"
stays deferred.

None of the new deliverables depends on D4b: comparison and plans read
each simulation's status and last successful result, and their statuses
converge on their own as recalculations land.

## D12b — Observed system curves from the Banco Central

Decided 2026-10-17 (see "Curvas Observadas do Sistema" in the
[curve specification](./index-value-curves.md)). The system keeps CDI and
effective SELIC curves from the Banco Central with the last published rate
kept onwards. In production the observed curves are the only system curves;
the seeded system curves exist only in the development environment.

**Decisions needed first** (options discussed 2026-10-28, not yet settled):

- Where the date of the last published value lives so the screens can show
  it, without queueing recalculations. Since D12a, the last interval's end
  can be that date, but today any interval change raises `valuesRevision`, so
  moving only the last end (same value) every day would recalculate every
  simulation on the curve; that rule needs a decision.
- How far back the import loads history, and the schedule's rate.
- How the values reach the backend: a scheduled event consumed by the API,
  which fetches from the last published date (leading option, no Lambda,
  but the fetch runs inside the consumer's transaction); a Lambda that
  publishes the values (cannot resume from the curve's state, and backfill
  chunks are unordered); or a Lambda that calls the API (needs machine
  authentication). See "Hosts" in
  [Messaging Transport](../architecture/messaging.md); the database never
  accepts connections from outside the backend. The backend applies the
  values, so the rule that adds an interval when the rate changes lives in
  the context.
- How the import runs locally.
- The Banco Central series: the annualized base-252 SGS series of the CDI
  and of the effective SELIC (expected 4389 and 1178; confirm when building).

Scope:

- Observed curves show their source and the date of the last published
  value.
- The backend fetches or receives the published values on the schedule and
  applies them through a curve use case as the system actor. An unchanged
  value extends the last interval's end; a new value adds an interval from
  its date; equal consecutive days form one interval. On business days of
  the product's calendar with no published value it repeats the previous
  value (interim decision), only for days before the latest value published.
  Running it twice for the same day changes nothing.
- A rate change recalculates the simulations using an observed curve
  through the D4b fan-out; this happens only when the rate changes (around
  the Copom meetings for the CDI).

**Done when** the observed CDI and SELIC curves stay current on their own,
their screens show the source and the last published date, and tests cover
the import's no-change, rate-change, missing-day, and repeated runs.
