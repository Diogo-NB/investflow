# Shared Domain

Framework-free building blocks that are intentionally reusable across bounded
contexts.

## Temporal values

Use these types throughout domain and application code:

- `CalendarDate` for civil dates such as maturity dates and business days. It
  serializes as `YYYY-MM-DD` and has no timezone.
- `CalendarDateRange` for validated intervals between two civil dates.
- `UtcInstant` for exact moments such as aggregate audit timestamps. It
  serializes as an ISO timestamp normalized to `Z`.

`CalendarDate` also formats the deterministic Brazilian `DD/MM/YYYY`
representation. Formatting a `UtcInstant` requires an explicit IANA timezone;
use the PT-BR temporal formatters exported by shared infrastructure rather than
relying on the process timezone.

Do not use native `Date`, epoch numbers, or ad hoc strings to implement temporal
business logic. This applies to domain models and services as well as commands,
use cases, ports, and events. Parse external values once, then pass these value
objects through application and domain code. Use their methods for arithmetic,
comparison, ranges, conversion, serialization, and formatting.

Native `Date` is only an interoperability type for infrastructure. Convert an
incoming native value with `UtcInstant.fromDate(...)`; use the defensive
`UtcInstant.date` getter when an ORM or framework requires a native value.
Obtain the current time through the shared application `Clock`: `now()` returns
an exact `UtcInstant`, while `today()` returns the current UTC `CalendarDate`.

## Money

Use `Money` for signed monetary amounts. A money value carries an explicit
three-letter uppercase currency code, defaults to `BRL`, and prevents arithmetic
or ordering comparisons between different currencies. Whether a particular
field may be negative is an invariant of the owning feature. Its JSON
representation preserves the decimal amount as a string.

Locale-sensitive display is an infrastructure concern. Use `formatMoney` with
an explicit locale or `formatMoneyPtBr` from `@investflow/shared-infrastructure`.

## Building

Run `pnpm nx build shared-domain` to build the library.

## Running unit tests

Run `pnpm nx test shared-domain` to execute the unit tests via Jest.
