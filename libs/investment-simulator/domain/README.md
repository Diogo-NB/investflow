# Investment Simulator Domain

Framework-free business rules for the Investment Simulator bounded context.
This project owns aggregates, value objects, domain services, events, and
domain errors. It must not import NestJS, Prisma, AWS SDKs, application code, or
infrastructure code.

Consumers import its public API through
`@investflow/investment-simulator-domain`.

Source is organized by plural business feature. Cohesive domain types stay
shallow within `src/lib/offers`, `src/lib/issuers`, `src/lib/applications`,
and `src/lib/calculations` instead of being split across global aggregate,
value-object, and error folders. Applications own saved investment hypotheses;
calculations own the calculation scenario, the calculator domain service,
taxes, and calculation results.

## Offer catalog

`Issuer` identifies the institution that issues an investment. `Offer` stores
the contractual conditions available before an application: title type,
issuer, maturity, redemption, remuneration, and optional soft deletion.

The catalog model is prepared for CDB, LCI, and LCA titles and for prefixed,
CDI percentage, Selic percentage, and IPCA-plus remuneration. `RemunerationTerms`
is a discriminated union whose variants name their rate by meaning:
`PrefixedRemuneration.annualRate`, `IndexPercentageRemuneration.percentage`
(CDI or SELIC), and `IpcaPlusRemuneration.annualSpread`. Each variant exposes
`requiredIndex` and the boundary-facing `contractRate`; `RemunerationTerms.create()`
builds the variant from the persisted or transported kind and rate.
This structural support does not expand the current MVP beyond CDB simulations.

Index curves expose the domain name `EconomicIndex` as an alias of the shared
`InvestmentType` enum, reusing its CDI, SELIC, and IPCA definitions.

Technical creation and update timestamps remain in persistence. Offers do not
validate future or business-day maturity dates at this stage. Deletion does
not restrict catalog aggregate updates; command repositories exclude deleted offers
from lookups and report them as not found.

## Offer snapshots and applications

`Offer.createSnapshot()` captures an offer under a new identity. Snapshots reuse
the offer model and its terms value objects, and retain the original catalog
offer ID in `sourceOfferId`. A non-null source identifies a snapshot. Snapshots
reject updates and deletion with `ImmutableOfferSnapshotError`; catalog changes
do not alter captured conditions. Deleted catalog offers cannot create snapshots.

Scenario experiments create replacement snapshots with optional maturity,
redemption, or remuneration overrides. Replacements retain the original catalog
provenance and leave previous snapshots intact.

`Application` is a saved investment hypothesis with an owner, snapshot reference,
optional index-curve reference, principal, investment date, and optional soft
deletion. Creation and revision receive the snapshot `Offer` and the chosen
`IndexCurve` but store only their IDs. Principal must be positive BRL, and the
proposed investment must form a valid `InvestmentScenario`: the investment date
precedes snapshot maturity, and a curve is linked exactly when the remuneration
requires one, matches its index, and is not deleted. Past dates, weekends, and
holidays are accepted without calendar adjustment; only calculation enforces
business days. Revisions validate the complete proposed investment state before
applying changes. Deleted applications cannot be revised; repeated deletion
preserves the first deletion instant.

`Application.toScenario()` rebuilds the calculable scenario from the loaded
snapshot and curve, rejecting deleted applications, foreign references, and
curves deleted after linking. Snapshots share the offer table and are excluded
from catalog queries and catalog commands.

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
calendar: the investment date precedes maturity, and a curve is present exactly
when the remuneration requires one, matches its index, and is not deleted. The
calculator then runs a linear pipeline:

1. `accrualPeriodsBetween()` requires business investment and maturity dates
   and pairs consecutive business days into `AccrualPeriod` values.
2. `resolveAccrualRates()` switches exhaustively over the remuneration kind and
   prices every period as a percentage of an annual effective rate (base 252):
   a fixed rate at 100%, or the curve value at the contracted percentage.
   `IndexCurve.valuesAt()` reports every uncovered reference at once; gaps are
   never filled. IPCA-plus returns an explicit unsupported error.
3. Daily balances compound `dailyAccrualFactor()`, cached per rate.
4. `CdbTaxCalculator` derives the maturity summary.

Only steps 1 and 2 return expected failures. Steps 3 and 4 are plain
arithmetic, wrapped once so that numeric overflow becomes
`INVESTMENT_CALCULATION_FAILED`. The calculator supports CDBs only. SELIC
means effective SELIC annualized on a 252-business-day basis. Rates use decimal
fractions: `0.12` is 12% annually and `1.05` is 105% of an index. Each result
carries `METHODOLOGY_VERSION`; bump it whenever formulas, conventions, or the
business calendar change the figures.

The rate on an interval's starting business day produces the balance at its
ending business day. A Friday-to-Monday interval accrues one factor using
Friday's rate. Maturity needs no index value of its own. Daily rows contain gross
balance, daily gross earnings, and accumulated gross earnings. The maturity
summary contains principal, gross balance, gross earnings, IOF, income tax, total
taxes, and net balance.

`CdbTaxCalculator` is a separate, infallible domain service. `CdbIncomeTaxPolicy` owns the
regressive income-tax schedule, selecting a `Rate` by holding period in calendar
days from explicit brackets and a long-term rate. `CdbIofPolicy` owns the
regressive IOF table, using shared `Rate` values for its nonzero rates, and
exemption from day 30 onward. The tax calculator names
the positive taxable earnings and income-tax base after IOF explicitly. Taxes
use calendar days and IOF before income tax, without reducing daily gross
balances. Calculations preserve decimal.js default precision without business
rounding. This does not reproduce B3-specific truncation and rounding.

## Simulation runs

`SimulationRun` is an immutable, append-only record of one successful
calculation of an `Application`. `SimulationRun.record()` freezes the
application's inputs at calculation time (offer snapshot ID, index-curve ID,
principal, and investment date), the calculation's `methodologyVersion`, the
`calculatedAt` instant supplied by the caller's clock, the maturity summary, and
every daily balance. Snapshots and curves are immutable, so those inputs fully
determine the scenario. Runs have no mutators and no deletion; revising an
application leaves its runs untouched, and read models derive whether a run is
outdated by comparing its inputs and methodology with the application's current
state and `METHODOLOGY_VERSION`.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
