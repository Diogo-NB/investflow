# Investment Simulator Domain

Framework-free business rules for the Investment Simulator bounded context.
This project owns aggregates, value objects, domain services, events, and
domain errors. It must not import NestJS, Prisma, AWS SDKs, application code, or
infrastructure code.

Consumers import its public API through
`@investflow/investment-simulator-domain`.

## Business-day calendar

`BrazilianBusinessDayCalendar` excludes weekends, the fixed holidays listed in
the product requirements, and four Easter-relative observances: Carnival
Monday (-48 days), Carnival Tuesday (-47 days), Good Friday (-2 days), and
Corpus Christi (+60 days). It inherits the convention that a business-day
interval excludes its start and includes its end.

Easter Sunday is calculated with the Gregorian algorithm published in Jean
Meeus, _Astronomical Algorithms_, 2nd edition, chapter 8, “Date of Easter”
(Willmann-Bell, 1998, ISBN 978-0-943396-61-3). See the
[bibliographic record](https://books.google.com/books?id=PPeIQgAACAAJ). The
implementation uses integer calendar arithmetic and returns the existing
`CalendarDate`; it does not read the system clock or create a native `Date`.
Known-date tests use the
[U.S. Census Bureau Easter table for 1600–2099](https://www.census.gov/data/software/x13as/genhol/easter-dates.html)
as an independent fixture source.

Exceptional B3 closures, state and municipal holidays, and extraordinary
calendar changes are not inferred by this algorithm. Add confirmed exceptions
to an explicit source-controlled registry when the product requires them.

## Building

Run `pnpm nx build investment-simulator-domain` to build the library.

## Running unit tests

Run `pnpm nx test investment-simulator-domain` to execute its Jest tests.
