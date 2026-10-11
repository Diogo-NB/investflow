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
their recorded calculations; calculations own the calculation scenario, the
calculator domain service, taxes, and calculation results.

## Offer catalog

`Offer` stores the contractual conditions available before an application:
title type, optional issuer name, maturity, redemption, remuneration, and
optional soft deletion. The issuer is a plain name, not a separate aggregate.

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

Technical creation and update timestamps remain in persistence. Offers do not
validate future or business-day maturity dates at this stage. Deletion does
not restrict catalog aggregate updates; command repositories exclude deleted offers
from lookups and report them as not found.

## Simulation inputs

`InvestmentTerms` holds the contractual terms of the title being simulated (title
type, optional issuer name, maturity, redemption, and remuneration) by value,
independent of the offer catalog. Filling the terms from a catalog offer copies
them, so later catalog edits or deletions never change a simulation.

`InvestmentInputs` is what each calculation varies: the principal, the
investment date, and the chosen index-curve ID (null for fixed rates).

## Investment calculation domain service

`InvestmentCalculator` is a synchronous, framework-free domain service under
`src/lib/calculations/investment-calculator.domain-service.ts`. It calculates an
`InvestmentScenario`: principal, investment and maturity dates, title type,
remuneration, and the index curve when the remuneration needs one. It does not
know aggregates, persistence, or clocks.

```typescript
const calculator = new InvestmentCalculator(new BrazilianBusinessDayCalendar());
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
   `IndexCurve.valuesAt()` reports every uncovered reference at once; gaps are
   never filled. IPCA-plus returns an explicit unsupported error, and
   `InvestmentCalculator.unsupportedReason()` tells screens which terms cannot
   be priced yet.
3. Daily balances compound the daily accrual factor, cached per rate.
4. `TaxCalculator` derives the maturity summary for the title type.

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
balance, daily gross earnings, and accumulated gross earnings. The maturity
summary contains principal, gross balance, gross earnings, IOF, income tax, total
taxes, and net balance.

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

## Simulations and calculations

`Simulation` is the title being simulated: its owner, the catalog offer its terms
were filled from (null for typed terms), its `InvestmentTerms`, fixed for its
life, and optional soft deletion that keeps the first instant. Other terms make
another simulation.

`Simulation.start()` creates a simulation only together with its first
successful calculation, and `calculate()` records another investment under the
same terms, rejecting deleted simulations. Both combine the terms with an
investment into the calculable `InvestmentScenario` and return the scenario rule
that breaks: principal positive BRL, investment before maturity, and a curve
exactly when the remuneration requires one, of its index and not deleted.
Passing a curve other than the referenced one is an invariant breach. Past
dates, weekends, and holidays pass the scenario; only calculation enforces
business days.

`SimulationCalculation` is an immutable, append-only record of one successful
calculation. It keeps the `InvestmentInputs`, the whole `InvestmentCalculation`
(methodology version, maturity summary, tax assessment, and every daily
balance), and the `calculatedAt` instant supplied by the caller's clock. The
simulation's fixed terms, the investment, and immutable index curves reproduce
the result under the recorded methodology.

A simulation's current investment is its latest calculation's; earlier ones
are its history. Failed calculations are never recorded.
`SimulationCalculation.isOutdated()` takes the plain title type and methodology
version so read models can flag calculations made under a methodology other
than the title's current one.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
