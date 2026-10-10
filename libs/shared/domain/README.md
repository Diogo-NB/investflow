# Shared Domain

Framework-free building blocks that are intentionally reusable across bounded
contexts.

Source is organized by reusable capability. Temporal values and business-day
calendars live together under `src/lib/dates`; rate validation and values live
under `src/lib/rates`; other foundations use cohesive roots such as `money`,
`investments`, and `foundations`. The latter co-locates the mutually dependent
DDD base abstractions. Shared code does not use global `value-objects`,
`services`, `errors`, or `utils` buckets.

## Temporal values

Use these types throughout domain and application code:

- `CalendarDate` for civil dates such as maturity dates and business days. It
  serializes as `YYYY-MM-DD` and has no timezone.
- `CalendarDateRange` for validated intervals between two civil dates.
- `UtcInstant` for exact moments with business meaning, such as redemptions,
  soft deletions, and domain-event occurrences. It serializes as an ISO
  timestamp normalized to `Z`.

Technical `created_at` and `updated_at` columns may remain in persistence
models without appearing in aggregates or entities. Add a temporal field to a
domain object only when business behavior uses it; database auditing alone does
not justify carrying it across the infrastructure boundary.

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
Depend on `Clock` only when application or domain behavior needs the current
time.

## Business-day calendars

`BusinessDayCalendar` provides reusable weekend and interval-counting behavior.
`BrazilianBusinessDayCalendar` additionally excludes the fixed dates 1 January,
21 April, 1 May, 7 September, 12 October, 2, 15 and 20 November, and 25
December. It also excludes four Easter-relative observances: Carnival Monday
(-48 days), Carnival Tuesday (-47 days), Good Friday (-2 days), and Corpus
Christi (+60 days). Business-day intervals exclude their start and include
their end.

Easter Sunday is calculated with the Gregorian algorithm published in Jean
Meeus, _Astronomical Algorithms_, 2nd edition, chapter 8, “Date of Easter”
(Willmann-Bell, 1998, ISBN 978-0-943396-61-3). See the
[bibliographic record](https://books.google.com/books?id=PPeIQgAACAAJ). The
implementation uses integer calendar arithmetic and returns `CalendarDate`; it
does not read the system clock or create a native `Date`. Known-date tests use
the
[U.S. Census Bureau Easter table for 1600–2099](https://www.census.gov/data/software/x13as/genhol/easter-dates.html)
as an independent fixture source.

Exceptional B3 closures, state and municipal holidays, and extraordinary
calendar changes are not inferred by this algorithm. Add confirmed exceptions
to an explicit source-controlled registry when a bounded context requires them.

## Money

Use `Money` for signed monetary amounts. A money value carries an explicit
three-letter uppercase currency code, defaults to `BRL`, and prevents arithmetic
or ordering comparisons between different currencies. Whether a particular
field may be negative is an invariant of the owning feature. Its JSON
representation preserves the decimal amount as a string.

Calculations use the default `decimal.js` precision. Do not introduce
business-level rounding for intermediate or final calculated values, and do
not convert amounts through JavaScript `number`. Persistence and transport
boundaries must preserve the calculated decimal value as a string.

Locale-sensitive display is an infrastructure concern. Use `formatMoney` with
an explicit locale or `formatMoneyPtBr` from `@investflow/shared-infrastructure`.
Display formatting may round according to its fraction-digit options, but it
must not replace or mutate the underlying calculated value.

## Rates

Use `Rate` for a positive decimal rate whose business meaning is supplied by
the owning domain field. Values are expressed in percentage points: `12` means
12%, `105` means 105% of an index, and `7.5` means 7.5%. `Rate` does not carry
an index or reference type; use expressive fields such as `annualRate` and
`indexRate` in the owning model.

Create rates from decimal strings at persistence and transport boundaries.
`Rate` rejects zero, negative, non-finite, and invalid
decimal values without converting through JavaScript `number`.

## Building

Run `pnpm nx build shared-domain` to build the library.

## Running unit tests

Run `pnpm nx test shared-domain` to execute the unit tests via Jest.
