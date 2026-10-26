# Implementation Roadmap

Delivery plan for the investment simulator. Product rules are in the
[PRD](./investment-simulator-prd.md) and the
[curve specification](./index-value-curves.md); the architecture is in
[Project Structure](../architecture/project-structure.md); screen behavior is
in [Frontend Patterns](../architecture/frontend-patterns.md).

The mutable-premises redesign (decided 2026-10-11, D0 to D6) has shipped
except D4b, resumed on 2026-10-26. This plan adds the next features: side-by-side
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
> outcome is reflected in the current state.

## Current State

Last updated 2026-10-26. D0 to D8 are done; D4b resumed on 2026-10-26, was
redesigned, and its first pull request (fact events, terms and values
revisions, the worker's early return) is done.

Built:

- **Messaging:** runs locally end to end on EventBridge and SQS emulated by
  Floci (see "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md)). The outbox
  poller publishes to the `investflow` bus every second, backs a failed event
  off on its own (up to 5 minutes) and pauses during broker outages; events
  above the 200 KB outbox payload limit fail at save time. Consumers are plain
  classes that the host binds to their queues; the API binds the simulation
  calculation consumer and its dead-letter consumer. Events are recorded in
  the unit of work (`UnitOfWork.run()`) that every request, consumer, and the
  seed runs in: aggregates through their repository's `save()`, services
  through the `DomainEventRecorder` port. The unit of work writes them to the
  outbox before commit, in chunks of 1,000 rows.
- **Curves:** independent, revisioned `Curve` aggregates with owners; `null`
  is the system. Alternatives of an index ("CDI base", "CDI otimista") are
  separate curves, and screens group them by index and origin; no grouping
  is stored. The API under `investment-simulator/curves` lists, reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  curves, always as the authenticated user. Every change writes an
  identifier-only event to the outbox. The seed creates the system curves
  through the same use case with the system actor. A curve has no missing
  business days (or months, for IPCA) between its first and last intervals;
  the domain rejects a gap with `CURVE_INTERVAL_GAP`. The `/curvas` screens
  list (filtered by index, with coverage), show (with a chart), create
  (optionally copying a base curve's intervals), edit, duplicate, and delete
  curves; intervals are typed in a row table kept contiguous, with
  business-day pickers and months for IPCA, and a curve's page lists the
  user's simulations that use it. A simulation missing curve values links to
  its curve.
- **Offers:** independent, revisioned `Offer` aggregates on the same model as
  curves: title type (fixed), name, optional issuer, remuneration and rate,
  maturity, and liquidity, with an owner (`null` is the system). Variants from
  one issuer are separate offers, and screens group them by title type and
  origin; no grouping is stored. The API under `investment-simulator/offers`
  lists (paginated, `q` matching name or issuer, `titleType`, `origin`),
  reads, creates, edits (revision check, `409` on mismatch), duplicates, and
  deletes offers as the authenticated user, and every change writes an
  identifier-only event to the outbox. The seed creates the system offers
  through the use case. The `/ofertas` screens list, search, show, create,
  edit, duplicate, and delete offers; an offer's page lists the user's
  simulations that use it, and its delete dialog and editor state how many.
- **Simulations:** reference a visible offer and, for indexed remuneration, a
  curve of its index, plus the principal and investment date; all are
  editable and the simulation has its own revision (`PATCH` with the revision,
  `409` on mismatch). "Digitar termos" and "Duplicar e ajustar" send the terms
  of a new private offer, created in the same transaction as the simulation;
  "Duplicar" opens a new simulation with the same choices. CDB, LCI, and LCA
  with prefixed, CDI, or effective SELIC remuneration on the 252 business-day
  convention, with IOF, income tax, and the LCI/LCA exemption.
- **Asynchronous calculation:** saving validates every rule except curve
  coverage on the request's fields, stores the calculation `PENDING` with its
  cause in `simulation_calculation`, and raises `SimulationCreated` or
  `SimulationEdited`; `PATCH` answers the new revision. The
  `simulation-calculations` consumer calculates through
  `SimulationCalculationService` and records `CALCULATED` or `INVALID` (an
  uncovered period, a deleted offer or curve) with a write conditional on the
  simulation revision, discarding stale outcomes. Its dead-letter consumer
  records `FAILED` over a calculation still `PENDING`, and
  `POST simulations/:id/recalculate` ("Tentar novamente") queues it again
  with `SimulationCalculationRequested`. The consumer handles all three
  events.
- **Results:** one current result per simulation, recording the simulation,
  offer, and curve revisions and the methodology version it used. Reads flag
  it "Desatualizado" when any of them changed, including a deleted offer or
  curve; saving queues a calculation from the current premises. The workspace
  polls every 3 seconds and shows the status and its cause ("Calculando",
  "Atualizado", "Requer ação" with the reason, "Falha técnica" with "Tentar
  novamente") over the last result, the summary, the tax explanation dialog,
  and the balance evolution chart with monthly rows; the list tags rows that
  are not up to date.
- **Return rates and remaining term:** a result is an `InvestmentProjection`
  with a term (business and calendar days) and a gross and a net
  `MaturityOutcome`, each with its final balance, earnings, and rate of return
  per year (over 252 business days), per month (the equivalent constant
  rate), and for the period, all derived from the balances and taxes.
  `simulation_result` also stores the rates and business days as a read model
  for sorting and aggregation. The workspace query returns the result in the
  same shape (term, gross, net, taxes), and the remaining term (phase,
  calendar days, and their years, months, and days) computed at read time
  from `Clock.today()` and the current dates, in any status. The results panel shows the term above the status, the net annual
  return beside the net value, and the "Rentabilidade" table with its
  explanation dialog; LCI and LCA show one "Líquida e bruta" column.
  `GET simulations` returns each row's net annual return and accepts
  `sort=netAnnualReturn` (descending, simulations without a result last, then
  newest first); `/simulacoes` shows the column and sorts with "Ordenar por",
  kept in the URL.
- **Simulation list filters:** `GET simulations` filters the owner's
  simulations by `offerId`, `curveId`, `titleType`, `remunerationKind`, and
  `calculationStatus`, combined with AND; there is no index filter because
  the remuneration kind fixes the index. `/simulacoes` filters with the same
  URL parameters, carried to a simulation and back, and the offer and curve
  screens count affected simulations from the `offerId` and `curveId`
  filters' totals.

- **Simulation comparison:** `GET simulation-comparisons?ids=a,b` reads 2 to 6
  of the owner's simulations in the requested order, each in the workspace's
  shape, and answers `404` when any is missing. The `SimulationComparison`
  value object ranks them by the net annual return of their last successful
  result, current or not: position, leader, and the gap to the leader in rate
  and, when every ranked result has the same principal and dates
  (`amountsComparable`), in money; `settled` says whether every result is
  current. Nothing is stored. `/simulacoes` selects simulations with
  checkboxes kept in the `comparar` URL parameter and a sticky bar, the
  workspace adds one with "Comparar com…", and `/simulacoes/comparar?ids=…`
  shows a verdict, a table on desktop and ranked cards below 1024px, removes
  and adds simulations, and polls while any is calculating.

Differs from the target model:

- Editing or deleting an offer or curve does not queue the simulations that
  use it; they are flagged "Desatualizado" until saved again (D4b, designed).
  The offer and curve screens say so in their impact notices.
- The queues are standard, not FIFO: two calculations of one simulation can
  overlap, and an outcome calculated from an older offer or curve revision
  can land after a newer one and stay "Desatualizado" until saved again. D4b
  makes the queues FIFO, grouped per aggregate.

Not started and outside this roadmap: IPCA calculation, early redemption, the
requeue after a methodology version change, and the "saldo hoje" balance,
which needs product refinement and a domain concept of its own (see "Deferred
Work" in [Project Structure](../architecture/project-structure.md) and the
PRD's "Pendências de Produto").

## Next Steps

1. Build D4b's remaining pull requests: FIFO queues, then fan-out.
2. Settle the portfolio membership decision (see D9) so D9 can start.
3. Settle the portfolio aggregation decisions (see D10) before D10.
4. Settle D12's decisions before D12.

## Overview

| #   | Deliverable                                                       | Depends on                    | Status      |
| --- | ----------------------------------------------------------------- | ----------------------------- | ----------- |
| D4b | Offer and curve changes recalculate the simulations that use them | D4a                           | In progress |
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
each simulation's status and last successful result, and those already show
"Desatualizado" until D4b ships. Once D4b ships, their statuses converge
on their own.

## D4b — Recalculation from premise changes

**Resumed (2026-10-26)** after a pause from 2026-10-13, and redesigned on
2026-10-26. Step 1 and the first pull request are done; the rest is decided
but not built, and the open points are listed last. Impact counts moved into D5 as the filtered
simulation list. Replace the offer and curve screens' interim copy
("ficarão desatualizadas até serem salvas novamente") with the recalculation
notice.

The flow is in walkthroughs 5 and 6 of
[Event Flow](../architecture/event-flow.md); the rules are under
"Recalculation" and "Messaging Transport" in
[Project Structure](../architecture/project-structure.md).

- **Done (step 1): events are recorded in the unit of work, not by the
  repository.** The `DomainEventRecorder` port lets services record events
  without aggregates, and `UnitOfWork.run()` writes them to `outbox_events`
  in chunks of 1,000 rows right before commit.
- **Done (PR A): only calculation-relevant changes recalculate.** Generic `OfferChanged`
  and `CurveChanged` split into `OfferTermsChanged` / `OfferDetailsChanged`
  and `CurveValuesChanged` / `CurveDetailsChanged`. Offers and curves keep
  `revision` for the `409` check and add `termsRevision` and
  `valuesRevision`, which results record instead of the full revisions, so
  renaming no longer flags simulations "Desatualizado".
- **Fan-out is a splitter in the simulations feature.**
  `SimulationRecalculationConsumer` handles `OfferTermsChanged`,
  `OfferDeleted`, `CurveValuesChanged`, and `CurveDeleted` directly, with no
  intermediate event. Its use case reads the ids of the live simulations
  that use the premise from the repository and records one
  `SimulationCalculationRequested` per id, all in the consumer's single unit
  of work: all or nothing, no paging, no aggregates loaded, and no
  calculation rows written. It scales with one transaction per premise
  change, a deliberate simplification to revisit ("Fan-out at scale" in
  Deferred Work).
- **The screen shows "Desatualizado" while a recalculation is on its way**,
  derived as today, not "Calculando"; a derived "Recalculando" status is
  deferred ("Recalculation status on screen" in Deferred Work).
- **Done (PR A): workers skip current work.** `CalculateSimulationUseCase`
  returns early when the calculation already applies to the current inputs
  (simulation revision, offer `termsRevision`, curve `valuesRevision`, and for
  a result the methodology version).
- **Deletion fans out like a change**; the worker finds the premise missing
  and records `INVALID` ("Sem oferta, escolha outra" / "Sem curva, escolha
  outra"). Fan-out never writes `INVALID` itself.
- **Exclusivity per simulation, not a wider guard.** Every consumer queue
  becomes SQS FIFO with content-based deduplication, grouped by
  `$.detail.aggregateId` on the rule target ("Exclusivity per aggregate"
  under "Messaging Transport"): one calculation per simulation runs at a
  time, so the calculation a fan-out queues runs after any in flight and
  reads the latest premises. The worker's check on the simulation revision
  stays as it is. Scope: `provision.sh` creates `.fifo` queues and
  dead-letter queues with the dynamic group, and the queue URLs in
  `.env.example` change. Floci enforces groups but not the dynamic path, so
  locally each queue is serial (documented gap); verify the path in a
  homolog environment before relying on parallel consumers.
- **Outbox ordering stays by `created_at`:** FIFO groups give exclusivity,
  not order, and consumers read current state, so no consumer needs order.
- **Methodology requeue: deferred.** See "Deferred Work" in
  [Project Structure](../architecture/project-structure.md).

- **No offer or curve causes.** Fan-out writes no calculation rows, so the
  cause kinds `OFFER_CHANGED`, `OFFER_DELETED`, `CURVE_CHANGED`, and
  `CURVE_DELETED`, the `cause_ref_id` column, and their frontend types are
  removed, and premise events carry no actor.
- **A dead-lettered fan-out has no consumer.** It wrote nothing, so its
  simulations stay "Desatualizado"; an alarm on the dead-letter queue
  prompts a redrive. A fan-out calculation that exhausts its retries is not
  recorded `FAILED` either, since nothing marked it `PENDING` (see
  "Recalculation status on screen" in Deferred Work).
- **"Current" for the early return:** a `CALCULATED` outcome for the current
  simulation revision, offer `termsRevision`, curve `valuesRevision`, and
  methodology version; an `INVALID` one for the same revisions (it records no
  methodology); or an `INVALID` for a premise that is still missing. `PENDING`
  and `FAILED` always calculate.
- **Ids come from `SimulationRepository.idsUsingOffer()` and
  `idsUsingCurve()`**, arrays of live simulations; no new port.
- **Publishing throughput: deferred** to "Fan-out at scale" (batched
  `PutEvents`, polling until empty, concurrent listeners).
- **Editor notices:** the offer and curve editors promise "As N simulações
  que usam esta oferta (curva) serão recalculadas." only while the edit
  changes terms or intervals, and show nothing for name, issuer, liquidity,
  or description (see [Frontend Patterns](../architecture/frontend-patterns.md)).
- **`SimulationCalculationRequested` is reused** for fan-out; its comment
  widens from "Tentar novamente" to any calculation requested without
  changing the simulation.
- **Delivery in three pull requests**, each keeping `pnpm check` green:
  1. Fact events (`OfferTermsChanged`, `OfferDetailsChanged`,
     `CurveValuesChanged`, `CurveDetailsChanged`), `termsRevision` and
     `valuesRevision` recorded by results (renaming stops flagging
     simulations), and the worker's early return.
  2. FIFO queues grouped per aggregate.
  3. Fan-out, the editor notices, and the removal of the unused causes.

**Done when** changing a curve's values or an offer's terms recalculates
every simulation that uses it, renaming either recalculates nothing and
flags nothing, and deleting either moves its simulations to "Requer ação".

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
  calling the API (see "Hosts" under "Messaging Transport" in
  [Project Structure](../architecture/project-structure.md); the database
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
- Until D4b ships, a rate change leaves the simulations using an observed
  curve "Desatualizado" until saved again; this happens only when the rate
  changes (around the Copom meetings for the CDI).

**Done when** a user can simulate an unmatured CDI or SELIC offer on an
observed system curve, every screen identifies the kept rate and the last
published date, and tests cover the open interval's validation and coverage
and the import's no-change, rate-change, missing-day, and repeated runs.

## D13 — "Hoje" marker on the balance chart (interim)

An interim stand-in for "saldo hoje" (see "Deferred Work" in
[Project Structure](../architecture/project-structure.md)), kept deliberately
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
