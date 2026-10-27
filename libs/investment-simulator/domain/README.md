# Investment Simulator Domain

Framework-free business rules for the Investment Simulator bounded context.
This project owns aggregates, value objects, domain services, events, and
domain errors. It must not import NestJS, Prisma, AWS SDKs, application code, or
infrastructure code.

Consumers import its public API through
`@investflow/investment-simulator-domain`.

Source is organized by plural business feature. Cohesive domain types stay
shallow within `src/lib/offers`, `src/lib/simulations`,
and `src/lib/calculations` instead of being split across global aggregate,
value-object, and error folders. Simulations own the user's simulations and
their current results; calculations own the calculation scenario, the
calculator domain service, taxes, and calculation results.

## Offer catalog

`Offer` is one aggregate with the same ownership and revision rules as
`Curve`: the title type (fixed, and through it the methodology and taxation),
the editable name, optional issuer name, maturity, redemption, and
remuneration, an owner, a revision, and soft deletion. The issuer is a plain
name, not a separate aggregate. Variants from one issuer are separate offers;
grouping them is left to screens. Changes raise `OfferCreated`,
`OfferTermsChanged` (maturity, remuneration), `OfferDetailsChanged` (name,
issuer, redemption), and `OfferDeleted` carrying only the offer's identity,
and a stale client revision is `OFFER_REVISION_CONFLICT`. Besides the
revision, `termsRevision` rises only with the terms, so results stay current
when an offer is renamed.

The catalog model is prepared for CDB, LCI, and LCA titles and for prefixed,
CDI percentage, Selic percentage, and IPCA-plus remuneration. `RemunerationTerms`
is a discriminated union whose variants name their rate by meaning:
`PrefixedRemuneration.annualRate`, `IndexPercentageRemuneration.percentage`
(CDI or SELIC), and `IpcaPlusRemuneration.annualSpread`. Each variant exposes
`requiredIndex` and the boundary-facing `contractRate`; `RemunerationTerms.create()`
builds the variant from the persisted or transported kind and rate.

## Title type rules

`TITLE_TYPE_RULES` (`offers/title-type-rules.ts`) is the single place that says
what differs by title, keyed exhaustively by `ETitleType` so a new title does
not compile until its rules exist: the methodology version, the regulated
minimum term in months, and the income-tax policy, where `null` means exempt.
CDB uses the regressive `IncomeTaxPolicy` and has no minimum term; LCI and LCA
are exempt (Lei nº 11.033/2004) and must mature at least 9 months after the
investment (CMN rule for titles not updated by a price index, applied to every
investment date). Consumers read the table instead of branching on the title.
Accrual does not vary by title, so there is no per-title calculator.

Index curves expose the domain name `EEconomicIndex` as an alias of the shared
`EInvestmentType` enum, reusing its CDI, SELIC, and IPCA definitions.

## Curves

`Curve` is one aggregate: the index (fixed, and through it the value
convention), the editable name, description, and intervals, an owner, and a
revision. Alternatives of one index are separate curves; grouping them is
left to screens. A `null` owner is the system: a user sees system curves and
their own, and changes only their own (`isVisibleTo()`, `canBeChangedBy()`).
`duplicateFor()` creates a private copy with the same content and no link to
its source.

Every change increments the revision once and raises past-tense events
(`CurveCreated`, `CurveValuesChanged` for the intervals,
`CurveDetailsChanged` for the name and description, `CurveDeleted`) carrying
only the curve's identity; an edit of both raises both. `valuesRevision`
rises only with the intervals, so results stay current when a curve is
renamed. An edit that changes nothing keeps the revisions and raises nothing.
`assertRevision()` reports a stale client revision as
`CURVE_REVISION_CONFLICT`.

Technical creation and update timestamps remain in persistence. Offers do not
validate future or business-day maturity dates at this stage. Deletion does
not restrict catalog aggregate updates; command repositories exclude deleted offers
from lookups and report them as not found.

## Simulation inputs

`InvestmentInputs` is what a simulation invests: the principal, the investment
date, and the chosen curve ID (null for fixed rates). The terms come from the
offer the simulation references.

## Investment calculation domain service

`InvestmentCalculator` is a synchronous, framework-free domain service under
`src/lib/calculations/investment-calculator.domain-service.ts`. It calculates an
`InvestmentScenario`: principal, investment and maturity dates, title type,
remuneration, and the curve when the remuneration needs one. It does not
know aggregates, persistence, or clocks.

```typescript
const calculator = new InvestmentCalculator();
const scenario = InvestmentScenario.create(props);
if (scenario.isErr()) return scenario;
const result = calculator.calculate(scenario.value);
```

`InvestmentScenario.create()` validates everything that does not depend on the
calendar: the investment date precedes maturity, the title's minimum term
(`INVESTMENT_TERM_TOO_SHORT`, measured with `CalendarDate.addMonths()`), and a curve is present exactly
when the remuneration requires one, matches its index, and is not deleted. The
calculator then runs a linear pipeline:

1. Accrual periods: the investment and maturity dates must be business days,
   and consecutive business days pair into periods.
2. Accrual rates: an exhaustive switch over the remuneration kind prices every
   period as a percentage of an annual effective rate (base 252): a fixed rate
   at 100%, or the curve value at the contracted percentage.
   `Curve.valuesAt()` reports every uncovered reference at once; gaps are
   never filled. IPCA-plus returns an explicit unsupported error, and
   `InvestmentCalculator.unsupportedReason()` tells screens which terms cannot
   be priced yet.
3. Daily balances compound the daily accrual factor, cached per rate.
4. `TaxCalculator` assesses IOF and income tax on the gross earnings over the
   term's calendar days, and the result is an `InvestmentProjection`.

Only steps 1 and 2 return expected failures. Steps 3 and 4 are plain
arithmetic, wrapped once so that numeric overflow becomes
`INVESTMENT_CALCULATION_FAILED`. Every title type is calculable. SELIC
means effective SELIC annualized on a 252-business-day basis. Rates use decimal
fractions: `0.12` is 12% annually and `1.05` is 105% of an index. Each result
carries its title's `methodologyVersion` from `TITLE_TYPE_RULES`; bump it
whenever formulas, conventions, taxes, or the business calendar change that
title's figures.

The rate on an interval's starting business day produces the balance at its
ending business day. A Friday-to-Monday interval accrues one factor using
Friday's rate. Maturity needs no index value of its own. Daily rows contain gross
balance, daily gross earnings, and accumulated gross earnings.

`InvestmentProjection` is the investment held to maturity. It stores only what
the calculation produced and derives the rest, so its figures cannot disagree:

- `principal`, the `methodologyVersion`, and the `InvestmentTerm`: investment
  and maturity dates, business days (interest and returns, one per daily row)
  and calendar days (taxes).
- `dailyBalances`, all gross, since taxes are due only at maturity.
- `taxes`, the `TaxAssessment` of IOF and income tax with their bases, rates,
  and total.
- `gross` and `net`, two `MaturityOutcome`s on the same principal: the final
  balance (the last daily balance, or that less every tax), the earnings
  (rendimento), and the `RateOfReturn` (rentabilidade) for the period,
  annualized over 252 business days (so a prefixed offer's gross annual
  return equals its rate), and as the equivalent constant monthly rate.

`RateOfReturn` is what an amount earned relative to the principal; `Rate`
stays for contracted and tax rates. Returns assume the investment is held to
maturity and add no methodology version, since they change no existing
figure; a future change to their definition must bump it.

`TaxCalculator` is a separate, infallible domain service. `IncomeTaxPolicy` owns the
regressive income-tax schedule, selecting a `Rate` by holding period in calendar
days from explicit brackets and a long-term rate; titles whose rules hold no
policy record an exempt income tax (null rate, zero amount). `IofPolicy` owns the
regressive IOF table, using shared `Rate` values for its nonzero rates, and
exemption from day 30 onward. The tax calculator names
the positive taxable earnings and income-tax base after IOF explicitly. Taxes
use calendar days and IOF before income tax, without reducing daily gross
balances. Calculations preserve decimal.js default precision without business
rounding. This does not reproduce B3-specific truncation and rounding.

## Simulations and results

`Simulation` references an offer by ID and holds its `InvestmentInputs`, an
owner, a revision, its `SimulationCalculation`, its last successful
`SimulationResult`, and optional soft deletion that keeps the first instant.
Changing the offer or the investment increments the revision; deleting does
too. `assertRevision()` reports a stale client revision as
`SIMULATION_REVISION_CONFLICT`.

Calculation is asynchronous. `Simulation.create()`, `edit()`, and
`requestCalculation()` set the calculation `PENDING` with its cause (kind, actor) and raise `SimulationCreated`, `SimulationEdited`,
and `SimulationCalculationRequested` respectively, all handled by the
calculation consumer; `edit()` does so even when nothing changed, so saving picks up changes to the offer and
curve. Deleted simulations reject both. `recordCalculation()` accepts a
`CALCULATED` or `INVALID` outcome only for the current revision of a
simulation that is not deleted, keeps the cause, and keeps the last result when
the outcome is invalid. `markCalculationFailed()` applies only while the
calculation is pending. `SimulationCalculation.appliesTo()` tells whether a
`CALCULATED` or `INVALID` outcome was recorded for given inputs.

`SimulationCalculationService` combines the offer's terms with the investment
into the calculable `InvestmentScenario`. `validate()` returns the first rule
that breaks: principal positive BRL, investment before maturity, minimum term,
a curve exactly when the remuneration requires one, of its index and not
deleted, supported remuneration, and business days (`InvestmentCalculator.check()`).
`calculate()` also checks curve coverage and returns a `CALCULATED` outcome with
the result or an `INVALID` one with the broken rule; a numeric failure throws
so the calculation is retried, and passing a curve other than the referenced
one is an invariant breach. `isCurrent()` tells whether the recorded outcome
already applies to the current premises (and, for a result, the current
methodology), so the worker can skip the calculation.

`SimulationResult` is the single current result: the whole
`InvestmentProjection` (whose term is the period it covered), the
`calculatedAt` instant, and the inputs it was calculated from (the simulation
revision, the offer's `termsRevision`, the curve's `valuesRevision`, and the
methodology version). A new successful calculation replaces
it. `SimulationResult.targetFor()` and `isCurrent()` take plain values, so read
models can flag a result whose premises or methodology changed since.

`RemainingTerm.at(today, investmentDate, maturityDate)` is computed at read time
from the current dates, not the result. It counts calendar days from today, or
from the investment date while that is in the future (`NOT_STARTED`); it is
zero on the maturity date and `MATURED` afterwards. Its split into years,
months, and days adds calendar months to the start as the LCI and LCA minimum
term does.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
