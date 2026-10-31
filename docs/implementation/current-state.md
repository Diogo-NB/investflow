# Current State

What is built today, per area, and where it still differs from the target
model. Pending features are in [planned/](./planned/); update
this file in the same change that ships or changes a built behavior.

## Built

- **Production:** runs at `https://investflow.diogo-nb.com.br` since
  `v0.1.0` (2026-10-31): the API, its migrations, and the web app as one
  Dokploy compose service on the shared VPS, released through pull
  requests and Release Please with GitHub Actions, with EventBridge and SQS on AWS provisioned by
  CDK. How and why is in
  [Production Deployment](../architecture/deployment.md); follow-ups are in
  [Production Hardening](./planned/production-hardening.md).
- **Messaging:** runs end to end on EventBridge and SQS FIFO queues, emulated
  locally by Floci. Events are recorded in the unit of work, written to the
  outbox before commit, published right after commit by the relay, and
  retried by a poller that several instances can run; publishing pauses
  during broker outages. The API binds the simulation calculation,
  dead-letter, and recalculation consumers. `pnpm bench:outbox` measures
  publishing latency. How it works, with its limits and timings, is in
  [Messaging Transport](../architecture/messaging.md); every event is in the
  [Event Catalog](../architecture/event-flow.md#event-catalog).
- **Curves:** independent, revisioned `Curve` aggregates with owners; `null`
  is the system. Alternatives of an index ("CDI base", "CDI otimista") are
  separate curves, and screens group them by index and origin; no grouping
  is stored. The API under `investment-simulator/curves` lists, reads,
  creates, edits (revision check, `409` on mismatch), duplicates, and deletes
  curves, always as the authenticated user. Every change writes an
  identifier-only event to the outbox. The seed creates the system curves
  through the same use case with the system actor. A curve has no missing
  business days (or months, for IPCA) between its first and last intervals;
  the domain rejects a gap with `CURVE_INTERVAL_GAP`. After the last
  interval's end its value holds onwards, so coverage can be missing only
  before the first start; the screens say so and the chart dashes the held
  stretch. The `/curvas` screens
  list (filtered by index, with coverage), show (with a chart), create
  (optionally copying a base curve's intervals), edit, duplicate, and delete
  curves; intervals are typed in a row table kept contiguous, with
  business-day pickers and months for IPCA, and a curve's page lists the
  user's simulations that use it. A simulation missing curve values links to
  its curve.
- **Offers:** independent, revisioned `Offer` aggregates on the same model as
  curves: title type (fixed), optional issuer, remuneration and rate,
  maturity, liquidity, and an optional name, with an owner (`null` is the
  system). The terms identify an offer, so screens lead with the title type
  and remuneration ("CDB 110% do CDI") and add the issuer and name; system
  offers have no name, and lists order offers by title type, origin,
  remuneration kind, rate (highest first), and maturity. Variants from one
  issuer are separate offers, and screens group them by title type and
  origin; no grouping is stored. The API under `investment-simulator/offers`
  lists (paginated, `q` matching name or issuer, `titleType`, `origin`),
  reads, creates, edits (revision check, `409` on mismatch), duplicates, and
  deletes offers as the authenticated user, and every change writes an
  identifier-only event to the outbox. The seed creates the system offers
  through the use case. The `/ofertas` screens list, search, show, create,
  edit, duplicate, and delete offers; an offer's page lists the user's
  simulations that use it, and its delete dialog and editor state how many.
- **Simulations:** reference a visible offer and, for indexed remuneration, a
  curve of its index, plus the principal and investment date; all are
  editable and the simulation has its own revision (`PATCH` with the revision,
  `409` on mismatch). "Digitar termos" and "Duplicar e ajustar" save the
  terms as a new private offer first (`POST /offers`), then the simulation
  with its `offerId`; a simulation rejected afterwards leaves that offer
  saved and chosen in the form. "Duplicar" opens a new simulation with the same choices. CDB, LCI, and LCA
  with prefixed, CDI, or effective SELIC remuneration on the 252 business-day
  convention, with IOF, income tax, and the LCI/LCA exemption.
- **Asynchronous calculation:** saving validates every rule except curve
  coverage on the request's fields, stores the calculation `PENDING` with its
  cause in `simulation_calculation`, and raises `SimulationCreated` or
  `SimulationEdited`; `PATCH` answers the new revision. The
  `simulation-calculations` consumer calculates through
  `SimulationCalculationService` and records `CALCULATED` or `INVALID` (an
  uncovered period, a deleted offer or curve) with a write conditional on the
  simulation revision, discarding stale outcomes. Its dead-letter consumer
  records `FAILED` unless the outcome is current for the premises, also
  after a premise recalculation, and
  `POST simulations/:id/recalculate` ("Tentar novamente") queues it again
  with `SimulationCalculationRequested`. The consumer handles all three
  events.
- **Results:** one current result per simulation, recording the input
  fingerprint of what it was calculated from (the simulation, offer, and curve
  revisions and the methodology version). Reads flag it "Desatualizado" when
  the current fingerprint differs, including a deleted offer or
  curve: the workspace and the list read `SimulationResultValidity` through
  `SimulationResultValidityReader` and answer its `isSettled`; saving queues a calculation from the current premises. The workspace
  polls every 3 seconds and shows the status and its cause ("Calculando",
  "Atualizado", "Requer ação" with the reason, "Falha técnica" with "Tentar
  novamente") over the last result, the summary, the tax explanation dialog,
  and the balance evolution chart with monthly rows; the list tags rows that
  are not up to date.
- **Return rates and remaining term:** a result is an `InvestmentProjection`
  with a term (business and calendar days) and a gross and a net
  `MaturityOutcome`, each with its final balance, earnings, and rate of return
  per year (over 252 business days), per month (the equivalent constant
  rate), and for the period, all derived from the balances and taxes.
  `simulation_result` also stores the rates and business days as a read model
  for sorting and aggregation. The workspace query returns the result in the
  same shape (term, gross, net, taxes), the curve with its `lastIntervalEnd`
  (its last declared date, after which its last value holds), and the remaining
  term (phase,
  calendar days, and their years, months, and days) computed at read time
  from `Clock.today()` and the current dates, in any status. The results panel shows the term above the status, the net annual
  return beside the net value, and the "Rentabilidade" table with its
  explanation dialog; LCI and LCA show one "Líquida e bruta" column.
  `GET simulations` returns each row's net annual return and accepts
  `sort=netAnnualReturn` (descending, simulations without a result last, then
  newest first); `/simulacoes` shows the column and sorts with "Ordenar por",
  kept in the URL.
- **Simulation list filters:** `GET simulations` filters the owner's
  simulations by `q` (part of the offer's name or issuer, ignoring case,
  up to 100 characters), `offerId`, `curveId`, `investmentPlanId` (the live members
  of a live plan), `titleType`, `remunerationKind`, and
  `calculationStatus`, combined with AND; there is no index filter because
  the remuneration kind fixes the index. `/simulacoes` filters with the same
  URL parameters, carried to a simulation and back; the investment plan's
  "Adicionar simulações" dialog reuses the filter bar with the filters held
  in memory, and the offer and curve
  screens count affected simulations from the `offerId` and `curveId`
  filters' totals.

- **Simulation comparison:** `GET simulation-comparisons?ids=a,b` reads 2 to 6
  of the owner's simulations in the requested order, each in the workspace's
  shape, and answers `404` when any is missing. `BuildSimulationComparisonUseCase`
  reads them through `ComparedSimulationReader` as `ComparedSimulation`s,
  which say whether their result is current and settled (calculated from the
  current premises with nothing queued), and builds the
  `SimulationComparison` value object, which ranks them by the net annual
  return of their last successful result, current or not: position, leader,
  and the gap to the leader in rate and, when every ranked result has the
  same principal and dates (`areAmountsComparable`), in money; `isSettled`
  says whether every simulation is settled, and each simulation carries its
  own `isSettled`. Nothing is stored. `/simulacoes` selects simulations with
  checkboxes kept in the `comparar` URL parameter and a sticky bar, the
  workspace adds one with "Comparar com…", and `/simulacoes/comparar?ids=…`
  shows a verdict, a table on desktop and ranked cards below 1024px, removes
  and adds simulations, and polls while any is calculating.
- **Investment plans:** a revisioned `InvestmentPlan` aggregate with an
  owner, a name, an optional description, a soft delete, and up to 50
  simulation ids, stored in `investment_plan` and
  `investment_plan_simulation`. Every change raises the revision and is
  saved with a write conditional on it, so concurrent adds conflict (`409`)
  instead of passing the limit. Members whose simulation was deleted are
  never loaded: they leave the plan and free their slot without a write. The
  API under `investment-simulator/investment-plans` lists (by name,
  paginated, optionally the plans of a `simulationId`), reads, creates,
  edits the name and description (revision check, `409` on mismatch),
  deletes, adds simulations (`POST …/simulations`, 1 to 50 of the owner's
  live simulations, safe to repeat; another owner's or a deleted one is
  `404`), and removes one (`DELETE …/simulations/:simulationId`, safe to
  repeat). Only the plan changes; `SimulationRepository.findIdsOwnedBy` checks
  the simulations. Reads return the member count, the free slots, and the
  status derived by `InvestmentPlanStatus`, in the list as well as the
  details. The details also return `totals` (null without any result),
  computed at read time by `InvestmentPlanTotalsCalculator` from each live
  member's last successful result, current or not, and its offer's current
  redemption type: the summed principal, IOF, income tax, net amount, and
  net earnings, the period, the maturity schedule by month, the principal
  split by liquidity, how many members were left out without a result, and
  whether the totals are provisional. Both are built in the application
  (`BuildInvestmentPlanStatusesUseCase`, `BuildInvestmentPlanTotalsUseCase`)
  from `InvestmentPlanMember`s read through the `InvestmentPlanMemberReader`
  port; the query handlers read only the plan and serialize (see "Domain
  Concepts on a Screen Read" in
  [queries.md](../architecture/queries.md)). No events. The `/planos` screens list, create, edit, delete,
  and show plans with their members and totals
  ([screens/investment-plans.md](../product/screens/investment-plans.md)). The
  simulation screens link to plans too: the workspace's "Planos" line names
  the simulation's plans and adds it to another one, its delete dialog says
  how many plans it leaves, and a simulation created from a plan's "Nova
  simulação" is offered to that plan in a toast
  ([screens/simulations.md](../product/screens/simulations.md)).

## Differs From the Target Model

- The CDI and SELIC curves imported from the Banco Central are not built
  ([BCB Rate Import](./planned/bcb-rate-import.md)).
- The simulation workspace cannot yet edit its own offer in place, with the
  offer editor's impact notice (see [Telas de Simulações](../product/screens/simulations.md)).
