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
calculations own the calculator domain service, remuneration strategies, taxes,
and calculation results.

## Offer catalog

`Issuer` identifies the institution that issues an investment. `Offer` stores
the contractual conditions available before an application: title type,
issuer, maturity, redemption, remuneration, and optional soft deletion.

The catalog model is prepared for CDB, LCI, and LCA titles and for prefixed,
CDI percentage, Selic percentage, and IPCA-plus remuneration. `RemunerationTerms`
holds a kind and a `Rate`; the domain interprets the rate according to the kind.
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
principal, investment date, and optional soft deletion. Creation and revision
receive a snapshot `Offer` but store only its ID. Principal must be positive BRL,
and the investment date must precede snapshot maturity. Past dates, weekends,
and holidays are accepted without calendar adjustment. Revisions validate the
complete proposed investment state before applying changes. Deleted applications
cannot be revised; repeated deletion preserves the first deletion instant.

This initial model is domain-only. Persistence does not yet store snapshot
provenance or applications. Portfolios and execution history are outside this
slice. Snapshots must not be saved through the existing offer
repository until persistence support is added.

## Investment calculation domain service

`InvestmentCalculator` is a synchronous, framework-free domain service under
`src/lib/calculations/investment-calculator.domain-service.ts`. It receives an
`Application`, its matching snapshot `Offer`, and an optional `IndexCurve`.
It does not load, persist, or mutate these aggregates and never reads a clock.
Application use cases will own aggregate loading and result persistence.

Construct it with a business calendar (the MVP uses
`BrazilianBusinessDayCalendar`) and remuneration strategies:

```typescript
const calculator = new InvestmentCalculator(new BrazilianBusinessDayCalendar(), [new PrefixedRemunerationStrategy(), new CdiPercentageRemunerationStrategy(), new SelicPercentageRemunerationStrategy()]);
const result = calculator.calculate({ application, offerSnapshot, indexCurve });
```

The calculator supports CDBs and requires business dates for investment and
maturity; storing a hypothesis still accepts non-business dates. Unsupported
titles and IPCA-plus remuneration return explicit errors. SELIC means effective
SELIC annualized on a 252-business-day basis. Rates use decimal fractions:
`0.12` is 12% annually and `1.05` is 105% of an index.

`BusinessDayAccrualSchedule` owns the investment-date and maturity-date policy
and returns the ordered business dates, including investment and maturity.
The calculator explicitly pairs consecutive dates into `DailyAccrual` steps,
with a `rateReferenceDate` and a `balanceDate`. The investment date anchors
the first step; it does not produce a daily balance row.
`RemunerationStrategy.prepare()` receives terms and daily steps, resolves all
required rate-reference values, and returns `PreparedDailyAccrual` entries
containing the two named dates and their factor. Entries preserve the supplied
order. Daily accrual follows the business-date sequence rather than the
containment or overlap semantics of a generic date range.
`AnnualEffective252AccrualPolicy` owns equivalent daily compounding and applying
a contracted percentage to the daily index rate. Fixed-rate, CDI, and SELIC
strategies share this convention while indexed strategies enforce their index.
Conversion factors are cached per rate within a calculation. Missing coverage,
deleted curves, and incompatible indexes are distinct failures; the calculator
never fills gaps automatically.

The rate on an interval's starting business day produces the balance at its
ending business day. A Friday-to-Monday interval accrues one factor using
Friday's rate. Maturity needs no index value of its own. Daily rows contain gross
balance, daily gross earnings, and accumulated gross earnings. The maturity
summary contains principal, gross balance, gross earnings, IOF, income tax, total
taxes, and net balance.

`CdbTaxCalculator` is a separate domain service. `CdbIncomeTaxPolicy` owns the
regressive income-tax schedule, selecting a `Rate` by holding period in calendar
days from explicit brackets and a long-term rate. `CdbIofPolicy` owns the
regressive IOF table, using shared `Rate` values for its nonzero rates, and
exemption from day 30 onward. The tax calculator names
the positive taxable earnings and income-tax base after IOF explicitly. Taxes
use calendar days and IOF before income tax, without reducing daily gross
balances. Calculations preserve decimal.js default precision without business
rounding. This does not reproduce B3-specific truncation and rounding.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
