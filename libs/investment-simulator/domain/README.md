# Investment Simulator Domain

Framework-free business rules for the Investment Simulator bounded context.
This project owns aggregates, value objects, domain services, events, and
domain errors. It must not import NestJS, Prisma, AWS SDKs, application code, or
infrastructure code.

Consumers import its public API through
`@investflow/investment-simulator-domain`.

Source is organized by plural business feature. Cohesive domain types stay
shallow within `src/lib/offers` or `src/lib/issuers` instead of being split
across global aggregate, value-object, and error folders.

## Offer catalog

`Issuer` identifies the institution that issues an investment. `Offer` stores
the contractual conditions available before an application: title type,
issuer, maturity, redemption, remuneration, and optional soft deletion.

The catalog model is prepared for CDB, LCI, and LCA titles and for prefixed,
CDI percentage, Selic percentage, and IPCA-plus remuneration. `RemunerationTerms`
holds a kind and a `Rate`; the domain interprets the rate according to the kind.
This structural support does not expand the current MVP beyond CDB simulations.

Technical creation and update timestamps remain in persistence. Offers do not
validate future or business-day maturity dates at this stage, and deleted
offers cannot be updated or restored.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
