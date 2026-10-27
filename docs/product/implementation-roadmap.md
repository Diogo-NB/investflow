# Implementation Roadmap

Delivery plan for the investment simulator. Product rules are in the
[PRD](./investment-simulator-prd.md) and the
[curve specification](./index-value-curves.md); the architecture is in
[docs/architecture](../architecture/); screen behavior is in
[screens](./screens/); what is built is in [Current State](./current-state.md).

The mutable-premises redesign (decided 2026-10-11, D0 to D6) has shipped,
D4b last (2026-10-26). This plan adds the next features: side-by-side
simulation comparison, portfolios, and the index curves observed from the
Banco Central with their kept rate.

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

Last updated 2026-10-27. D0 to D8 and D4b are done: offer and curve changes
recalculate the simulations that use them, over FIFO queues grouped per
aggregate. Events are now published right after their transaction commits.

What is built, area by area, and where it differs from the target model
is in [Current State](./current-state.md).

Not started and outside this roadmap: IPCA calculation, early redemption, the
requeue after a methodology version change, and the "saldo hoje" balance,
which needs product refinement and a domain concept of its own (see
[Deferred Work](../architecture/deferred-work.md) and the
PRD's "Pendências de Produto").

## Next Steps

1. Settle the portfolio membership decision (see D9) so D9 can start.
2. Settle the portfolio aggregation decisions (see D10) before D10.
3. Settle D12's decisions before D12.

## Overview

| #   | Deliverable                                                       | Depends on                    | Status      |
| --- | ----------------------------------------------------------------- | ----------------------------- | ----------- |
| D4b | Offer and curve changes recalculate the simulations that use them | D4a                           | Done        |
| D7  | Simulation return rates and remaining term                        | —                             | Done        |
| D8  | Side-by-side simulation comparison                                | D7                            | Done        |
| D9  | Portfolios: management, membership, and derived status            | membership decision           | Not started |
| D10 | Portfolio totals and average return                               | D7, D9, aggregation decisions | Not started |
| D11 | Portfolio comparison                                              | D8, D10                       | Not started |
| D12 | Open-ended last curve interval and observed system curves         | D12 decisions                 | Not started |
| D13 | "Hoje" marker on the balance chart (interim)                      | —                             | Not started |

```text
(membership decision)   ──► D9
D7                      ──► D8
D7, D9 + (aggregation decisions) ──► D10
D8, D10                 ──► D11
D4a                     ──► D4b
(D12 decisions)         ──► D12
```

Recommended order: D9, D10, D11. D12 and D13 depend on none of them and can
be scheduled in between. D7 went first because comparing
simulations with different terms needs their annualized return, and a
portfolio's average return builds on the simulations' rates. D11 comes last because it reuses the comparison screen's patterns
and the portfolio totals.

None of the new deliverables depends on D4b: comparison and portfolios read
each simulation's status and last successful result, and their statuses
converge on their own as recalculations land.

## D9 — Portfolios: management, membership, and derived status

A portfolio has a name and a description and groups simulations of its owner.
It lives in the `investment-simulator` context under a `portfolios` feature
root; its status derives from its simulations at read time, so it raises no
events and needs no consumer.

**Decision needed first:**

- Whether a simulation can belong to several portfolios or only one.
- What happens to a portfolio when one of its simulations is deleted (the
  membership disappears) and to its simulations when it is deleted (they are
  kept), and whether the screens say so.
- Whether a portfolio has a revision with a `409` check, like offers, curves,
  and simulations.
- Whether a simulation can be created directly inside a portfolio.

Scope:

- The `Portfolio` aggregate with owner, name, description, and its simulation
  ids; API to list, read, create, rename and describe, delete, and add or
  remove simulations, always as the authenticated user.
- A portfolio is in update while any of its simulations is calculating and
  has a pending issue while any is in "Requer ação" or "Falha técnica"
  (PRD), computed by the read query.
- `/portfolios` screens (names decided with the screens) to list, create,
  edit, delete, and show a portfolio with its simulations, their statuses,
  and their last results; the simulation workspace shows the portfolios a
  simulation belongs to.
- A portfolio's "Comparar" opens `/simulacoes/comparar?ids=…` with its
  simulations (up to the comparison's six), so groups of alternatives are kept
  as portfolios rather than as saved comparisons.

**Done when** a user can manage portfolios and their simulations, and a
portfolio's derived status follows its simulations' statuses.

## D10 — Portfolio totals and average return

**Decisions needed first** (PRD "Pendências de Produto"):

- The aggregation rule for simulations with different maturities. The PRD
  proposes the farthest maturity as the analysis date, summing only the
  simulations still active then and not reinvesting matured ones; it must be
  validated, since it can drop matured simulations from the total.
- The meaning and calculation of the average return (for example, weighted by
  principal) and whether it is gross or net, consistent with D7.

Scope:

- The portfolio query computes the totals (principal, gross and net amounts,
  income, IOF, income tax) and the average return on the server, using each
  simulation's last successful result (PRD), and flags totals that include
  results that are not up to date.
- The portfolio screen shows the totals with the portfolio's status.

**Done when** a portfolio shows its totals and average return under the
settled rules, with tests for mixed maturities, missing results, and
statuses that are not up to date.

## D11 — Portfolio comparison

The PRD asks to compare portfolios by their aggregated values and average
return.

Scope:

- Selecting portfolios and comparing their totals, average returns, and
  statuses side by side, reusing D8's approach: the selection in the URL with
  a sticky bar, a verdict ranked on the server, a table on desktop and ranked
  cards below 1024px, and polling only while something is calculating.

**Done when** a user can compare two or more portfolios' totals and average
returns side by side.

## D12 — Open-ended last curve interval and observed system curves

Decided 2026-10-17 (see "Taxa Mantida e Curvas Observadas" in the
[curve specification](./index-value-curves.md)). A curve of published values
ends the day before today, so it cannot price an offer that has not matured
or an investment made today. The last interval of any curve may have no end,
and the system keeps CDI and effective SELIC curves from the Banco Central
with the last published rate kept onwards. The kept rate is always shown;
nothing about it is implicit.

In production the observed curves are the only system curves. Lambdas
triggered by EventBridge Scheduler at a defined rate fill their values. The
seeded system curves exist only in the development environment.

**Decisions needed first:**

- Where the date of the last published value lives so the screens can show
  it. The curve changes only when the rate changes, so its intervals do not
  carry that date, and recording it must not raise the curve's revision or
  queue recalculations.
- How far back the import loads history, and the schedule's rate.
- How the Lambda delivers the published values: by publishing an event or by
  calling the API (see "Hosts" in
  [Messaging Transport](../architecture/messaging.md); the database
  never accepts connections from outside the backend). The backend applies
  them, so the compare-and-split rule lives in the context, not in the
  Lambda.
- How the Lambda runs locally (on Floci or a local runner).
- The Banco Central series: the annualized base-252 SGS series of the CDI
  and of the effective SELIC (expected 4389 and 1178; confirm when building).

Scope:

- `CurveInterval` accepts no end on the last interval only: validation,
  ordering, gap checks, value lookup, and coverage handle it, and duplicating
  keeps it. The API reads and writes the interval end as nullable.
- The curve screens: the editor offers "sem fim" on the last row; the list,
  the details, and the chart show the interval as "dd/mm/aaaa em diante" and
  mark the kept rate; observed curves show their source and the date of the
  last published value.
- The simulation workspace shows, beside the curve, the date from which the
  calculation uses the kept rate whenever the term reaches it.
- A Lambda host under `apps/` fetches the published values from the Banco
  Central on the schedule and delivers them to the backend, which applies them
  through a curve use case as the system actor. An unchanged value
  writes nothing; a new value closes the open interval on the previous
  business day and opens a new one; equal consecutive days form one interval.
  On business days of the product's calendar with no published value it
  repeats the previous value (interim decision). Running it twice for the
  same day changes nothing.
- The development seed's system CDI and SELIC curves end with an open
  interval, so local data behaves like production.
- A rate change recalculates the simulations using an observed curve
  through the D4b fan-out; this happens only when the rate changes (around
  the Copom meetings for the CDI).

**Done when** a user can simulate an unmatured CDI or SELIC offer on an
observed system curve, every screen identifies the kept rate and the last
published date, and tests cover the open interval's validation and coverage
and the import's no-change, rate-change, missing-day, and repeated runs.

## D13 — "Hoje" marker on the balance chart (interim)

An interim stand-in for "saldo hoje" (see
[Deferred Work](../architecture/deferred-work.md)), kept deliberately
small.

Scope:

- The workspace balance chart marks today, with the same date as the
  remaining term, and the gross balance of the result's last daily balance
  on or before it, labelled as an estimate. It appears only when today falls
  between the investment date and maturity.
- Frontend only: it reads the daily balances the workspace already returns.
  No new backend field, domain concept, list column, or comparison row.

**Done when** the chart shows the marker in that window and hides it outside,
with a unit test for picking the balance.
