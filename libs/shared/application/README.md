# shared-application

Application-layer contracts shared by bounded contexts.

Keep this library framework-light. It may depend on shared domain primitives,
but it must not depend on infrastructure or feature-specific contexts.

Source is organized by reusable capability. Clock abstractions live under
`src/lib/clocks`, and shared execution contracts live under
`src/lib/handlers`.

## Time

Application code must depend on the exported `Clock` port instead of calling
`Date.now()` or `new Date()`. Use `Clock.now()` when an exact `UtcInstant` is
required and `Clock.today()` when the rule needs the current UTC
`CalendarDate`. Commands, use cases, and ports should carry shared temporal
value objects after input parsing, never native `Date` values.
