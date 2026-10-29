# Queries

How query handlers are written (contracts, selections, mapping) is owned by
`investflow-nestjs-infrastructure`. This file records why screens read
through screen-oriented queries and what those queries return.

## Screen-Oriented Queries (Backend For Frontend)

Decision dated 2026-10-10: complex screens, such as the simulation workspace,
read through queries designed for that screen. The bounded context's own
infrastructure serves them; there is no separate BFF service or layer.

In practice:

- Design the query handler from the screen's usage. Start from what the screen
  shows and decides, then shape the output contract for it: name it after the
  usage, include only the fields the screen uses, and compose related data the
  screen always needs together into one read instead of several round trips.
- Compute business facts on the server, where the rules live: eligibility
  ("can be calculated"), status flags ("settled"), counts, and derived dates
  or periods. The browser must not re-implement domain rules to obtain values
  the screen displays or acts on.
- Keep outputs plain data under the usual contract rules: ISO dates, exact
  decimal strings, stable codes, and enums.
- This applies to reads. Commands and use cases stay shaped by the domain.
  Generic lookups (for example, the offer list) remain fine when a screen
  uses them as they are; add a screen query when the screen needs shaping or
  composition.

What it does not mean:

- No backend-driven layout or UI schemas. The backend does not decide sections,
  ordering on the page, components, or visibility of UI elements.
- No render-ready generic structures (such as `{ type: 'card', fields: [...] }`)
  and no frontend components from the backend.
- No presentation formatting or copy: currency and date formatting, labels,
  messages, and translations stay in the frontend, which formats the exact
  values it receives.

Exception (2026-10-10): a calculation's tax explanation formulas (such as
"R$ 217,38 × 22,5% = R$ 48,91") are written out by the query projection from
the values the domain recorded, so the screen shows them as they are. The
projection only formats; the domain decides every value and the tax rules.

## Domain Concepts on a Screen Read

Decision dated 2026-10-28: when a screen shows a domain concept computed from
several aggregates' state, such as an investment plan's status and totals, the
domain models the concept and the application builds it. A read port in
domain terms (`InvestmentPlanMemberReader`) returns the inputs as domain
objects, a read use case (`BuildInvestmentPlanTotalsUseCase`) gets today from
`Clock` and calls the domain, and the query handler reads only what belongs
to the screen itself and serializes the result.

- The query handler never assembles domain inputs from rows: which records
  count, which result applies, and which date is today are domain and
  application decisions. A handler that selects fields to fill a value
  object's input contract is that concept's domain service in disguise.
- The concept is derived at read time and never stored. A stored projection
  kept by events pays off only with a need it serves: sorting or filtering
  by the concept across many records, a frozen snapshot the business names,
  or another context consuming it.
- Each read is bounded by a domain invariant, not by today's volume: a plan
  reads at most `InvestmentPlan.SIMULATION_LIMIT` members, a page of plans
  at most the page size times that limit, and a simulation comparison at
  most `SimulationComparison.MAX_SIMULATIONS` simulations.
- The simulation comparison follows the same shape:
  `ComparedSimulationReader` returns `ComparedSimulation`s, which say whether
  their result is current and settled, and `BuildSimulationComparisonUseCase`
  builds `SimulationComparison`.
- Whether one simulation's result is current and settled is
  `SimulationResultValidity`, which `ComparedSimulation` and
  `InvestmentPlanMember` also delegate to. The workspace and the simulation
  list read it through `SimulationResultValidityReader` and pass its
  `isSettled` to the screen, which never derives it from the status.
- A read use case exists when it adds a step: a check across the records
  read, today from `Clock`, or a domain service. When the read port already
  returns the concept, as `SimulationResultValidityReader` does, the query
  handler calls the port directly (decided 2026-10-28).
- A paged list pages by stored columns and then reads the domain concept for
  the page's ids, bounded by the page size: the simulation list filters by
  the stored calculation status and sorts by the last result's net annual
  return, both of which include stale results, as the investment plan list
  pages plans before `BuildInvestmentPlanStatusesUseCase` reads their
  members. A port that returns a page would move the screen's filters and
  sort into the application (decided 2026-10-28).
