# Context: the investment simulation model in InvestFlow

This brief gives a fresh session the background on one modeling problem. It
describes what exists, why it was built that way, and what the problem is. It
deliberately contains no proposed solutions.

## Where to read first

- `AGENTS.md`: repository rules (layers, query handlers, Backend-for-Frontend
  queries, Deferred Work, coding conventions, comment rule, shared-function rule).
- `.agents/skills/investflow-domain-application/SKILL.md`,
  `.agents/skills/investflow-nestjs-infrastructure/SKILL.md`,
  `.agents/skills/investflow-react/SKILL.md`: layer-specific conventions.
- `docs/product/investment-simulator-prd.md`: product rules (Portuguese). The
  sections "Simulações de CDB" and "Execuções de Simulação" define today's
  behavior.
- `libs/investment-simulator/domain/README.md`: sections "Offer snapshots and
  applications" and "Simulation runs" record the original domain rationale.
- `docs/architecture/project-structure.md`: Backend for Frontend and Deferred
  Work.

## Stack and layout (short)

NestJS 11 modular monolith on Nx and pnpm, Prisma on PostgreSQL, React 19 SPA.
The bounded context is `libs/investment-simulator/{domain,application,infrastructure,web}`.
The domain is framework-free and uses `Result<T, E>`, `Money`, `Rate`,
`CalendarDate` and `UtcInstant` from `@investflow/shared-domain`. Queries are
infrastructure query handlers that read Prisma directly and return
screen-oriented contracts.

## Product behavior today

- **The user's view:** a user creates CDB "simulações". The UI says "simulação"
  for an application and "cálculo" for a run; users never see "snapshot",
  "application" or "run".
- **Entering terms:** terms are typed freely, or filled from a catalog offer
  ("Preencher com uma oferta") and then adjusted. Typed terms must not create
  catalog offers.
- **One action:** "Calcular" saves the inputs and records a calculation in one
  step. There is no separate save button.
- **History and staleness:**
  - Every successful calculation is kept, and the workspace shows a
    calculation history; `?calculo=<id>` selects an older one.
  - A calculation is shown as "Desatualizado" when the simulation's current
    inputs or the current methodology differ from the ones it was computed
    with.
  - Unsaved form edits are also flagged in the UI.
- **Rejected calculations:** if saving succeeds but the calculation is rejected
  (for example a non-business date or missing curve coverage), the inputs stay
  saved and the error is shown on the relevant field.
- **Other actions:** "Duplicar" opens a new simulation prefilled from an
  existing one. "Excluir" soft-deletes it.
- **Not built yet:** the PRD also lists portfolios (grouping simulations) and
  side-by-side comparison.

## The current model (domain)

### `Offer` (`domain/src/lib/offers/offer.aggregate.ts`)

A catalog entry for contractual terms. It holds:
- titleType, issuerId, maturityDate;
- redemptionTerms, remunerationTerms;
- deletedAt;
- `sourceOfferId`, `isSnapshot`.

The same aggregate and table also store **offer snapshots**, which are
immutable copies of terms owned by applications:
- `createSnapshot(overrides)` copies a catalog offer and keeps `sourceOfferId`.
- `createCustomSnapshot(props)` holds typed terms, with `sourceOfferId` null and
  `isSnapshot` true.
- `differsFrom(overrides)` tells whether a revision needs a new snapshot.
- Snapshots reject updates and deletion.
- Catalog queries filter `isSnapshot: false`.

### `Application` (`domain/src/lib/applications/application.aggregate.ts`)

A "saved investment hypothesis". It holds:
- ownerId;
- offerSnapshotId, indexCurveId (null for fixed rates);
- principal, investmentDate;
- deletedAt.

It is mutable through `revise()`. It validates that its inputs form a valid
`InvestmentScenario`. `toScenario(snapshot, curve)` rebuilds the calculable
scenario from the loaded snapshot and curve.

### `InvestmentScenario` (`domain/src/lib/calculations/investment-scenario.vo.ts`)

A validated calculable scenario. It holds:
- principal, investmentDate, maturityDate;
- titleType, remuneration;
- indexCurve (the loaded aggregate).

### `InvestmentCalculator` (`domain/src/lib/calculations/investment-calculator.domain-service.ts`)

`calculate(scenario)` returns an `InvestmentCalculation`
(`investment-calculation.type.ts`), which holds:
- methodologyVersion;
- dailyBalances[];
- maturitySummary: principal, grossBalance, grossEarnings, iof, incomeTax,
  totalTaxes, netBalance;
- taxation (`TaxationBasis`): holdingPeriodCalendarDays, taxableEarnings,
  incomeTaxBase, iofRate or null, incomeTaxRate.

### `SimulationRun` (`domain/src/lib/simulation-runs/simulation-run.aggregate.ts`)

An immutable, append-only record of one successful calculation of an
application. `SimulationRun.record({ application, calculation, calculatedAt })`
copies:
- from the application: ownerId, applicationId, offerSnapshotId, indexCurveId,
  principal, investmentDate;
- from the calculation: methodologyVersion, maturitySummary, taxation,
  dailyBalances;
- calculatedAt, from the clock.

`SimulationRun.isOutdated(run, application)` compares the copied inputs and the
methodology with the application's current values. It takes plain values
(`CalculationInputs`, `RecordedCalculationInputs`) so queries need not load
aggregates.

### `IndexCurve`, `Issuer`

Separate aggregates.
- Curves are immutable once created: a change creates a new curve.
- Curves can be soft-deleted, and a deleted curve cannot be linked.

## Persistence (Prisma, `libs/shared/infrastructure/prisma/schema.prisma`)

- `investment_offer`: catalog offers and snapshots together (`is_snapshot`,
  `source_offer_id`).
- `investment_application`: id, owner_id, offer_snapshot_id, index_curve_id,
  principal, investment_date, deleted_at, created_at, updated_at.
- `simulation_run`:
  - id, owner_id, application_id;
  - copies of offer_snapshot_id, index_curve_id, principal, investment_date;
  - methodology_version, calculated_at;
  - gross_balance, gross_earnings, iof, income_tax, total_taxes, net_balance;
  - holding_period_calendar_days, taxable_earnings, income_tax_base, iof_rate,
    income_tax_rate.
- `simulation_run_balance`: run_id, date, gross_balance, daily_gross_earnings,
  accumulated_gross_earnings.

## Why it was built this way (recorded rationale)

1. **Snapshots as offers.** The terms a simulation uses must not change when the
   catalog offer is edited or deleted, so the application points at an
   immutable copy. Reusing the `Offer` model and its terms value objects avoided
   a second terms model. The design originally assumed a simulation always
   comes from a catalog offer.
2. **Custom terms (added on the current branch).** Typed terms that don't
   create a catalog entry became a requirement. Snapshots were reused with
   `createCustomSnapshot`, and `isSnapshot` was added because `sourceOfferId !=
   null` could no longer identify a snapshot.
3. **Application separate from runs.** The PRD asks for reproducibility and
   history: each calculation is recorded as an immutable, append-only record,
   and editing a simulation must not alter past calculations. The application
   is the mutable "current hypothesis"; runs freeze what was calculated.
4. **Inputs copied onto the run.** Snapshots and curves are immutable, so the
   four input fields fully determine a run's scenario. Copying them lets a run
   stand alone and lets "outdated" be derived by comparison.
5. **Resending identical terms keeps the snapshot** (`differsFrom`), so earlier
   runs do not all become "outdated" when nothing actually changed.
6. **Taxation basis on the run (added on the current branch).** The screen
   explains how taxes were computed, and the tax rules must live in the domain,
   so the basis is recorded with each run instead of being recomputed by
   queries.
7. **"Outdated" moved into the domain (current branch).** It used to be a
   comparison in a query projection. Business rules must not live in query
   handlers, so it became `SimulationRun.isOutdated`.

## The problem

The model repeats the same information across concepts, and the owner (the
user) now questions whether the separation itself is worth keeping:

- **Inputs are duplicated.** The investment inputs (offerSnapshotId,
  indexCurveId, principal, investmentDate) live in:
  - `Application`, `SimulationRun` and the `CalculationInputs` interface in the
    domain;
  - both `investment_application` and `simulation_run` in the database.

  `SimulationRun.record()` copies them field by field, as it does ownerId and
  applicationId.
- **The calculation result is re-declared.** `SimulationRun` re-declares every
  field of `InvestmentCalculation` (methodologyVersion, maturitySummary,
  taxation, dailyBalances) instead of holding it.
- **Snapshots live in the catalog table.** Offer snapshots share the catalog
  table and aggregate. That required `isSnapshot`, filters in every catalog
  query, and snapshot-specific behavior on `Offer`.
- **The owner's question, in their words:** "im starting to NOT see value in
  Application != calculation run". They also said "nothing is out of the
  picture, we can recreate everything if needed".

## Constraints any change must respect

These are the user's stated standards from this project:

- **Business rules live in the domain.** Query handlers only select and map
  into screen-oriented contracts (BFF), with no business rules. One recorded
  exception: the tax formula text is formatted by the backend.
- **No small shared function files.** Behavior belongs to its owner: an
  aggregate, a value object, a domain service, or a port.
- **Error handling:**
  - Guard clauses, as in `if (r.isErr()) return r;`. `Result` has no `andThen`.
  - Error codes come from the single `EAppErrorCode` enum.
  - Error messages are user-facing pt-BR.
- **Types:**
  - Every enum name is prefixed with `E`.
  - Money and rates are decimals, never `number`.
  - Calendar dates are `CalendarDate` and never become instants.
- **Ownership:** each user sees only their own simulations, and owner scoping
  goes through `repository.findById(id, ownerId)`.
- **Comments:** only non-obvious constraints, side effects or workarounds.
- **Product rules stay:** these PRD rules are not up for change:
  - reproducible results;
  - a methodology version on each result;
  - calculation failures are never recorded;
  - deleting a simulation hides its results.

## What depends on the current model

- **Use cases** (`application/src/lib/`):
  - `applications/create`, `applications/revise`, `applications/delete`;
  - `simulation-runs/record`;
  - `offers/*` (catalog CRUD).
- **HTTP** (base `/api/investment-simulator`):
  - `POST applications`, `PUT applications/:id`, `DELETE applications/:id`;
  - `POST applications/:id/runs`, `GET applications` (list with latest run);
  - `GET simulation-options`, `GET simulation-workspaces/:id`;
  - `GET simulation-runs/:runId/monthly-balances`;
  - `GET business-calendar/non-business-days`.
- **Screen queries** (`infrastructure/src/lib/.../queries/`): the list query
  derives `latestRun.outdated`; the workspace query returns
  `calculations: CalculationSummary[]` with `outdated` per item.
- **Frontend** (`libs/investment-simulator/web`):
  - `use-simulation-workspace.ts` holds the create or revise, then calculate,
    chain and the saved-but-rejected path;
  - `use-calculation-history.ts`;
  - `calculation-panel.tsx` with the "Desatualizado" notice and the history
    list;
  - the list page's "Desatualizada" tag.
- **Migrations:** `add_offer_snapshot_flag`, which backfills `is_snapshot`, and
  `record_simulation_run_taxation`, which backfills the tax columns with SQL
  that duplicates the CDB tax rules.

## Docs that describe the current model

Any redesign must update these:

- `docs/product/investment-simulator-prd.md`: "Simulações de CDB" and
  "Execuções de Simulação".
- `libs/investment-simulator/domain/README.md`: "Offer snapshots and
  applications" and "Simulation runs".
- `docs/architecture/frontend-patterns.md`: "Simulation workspace behavior".
- `DESIGN.md`: the workspace and list layout notes.

## How to verify

- Before Node, pnpm or Nx commands: `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use`.
- Prefix Nx commands with `NX_DAEMON=false`.
- `pnpm check` runs lint, test, typecheck and build for every project.
- The infrastructure integration tests are skipped unless
  `INVESTMENT_SIMULATOR_TEST_DATABASE_URL` and `INDEX_CURVE_TEST_DATABASE_URL`
  are set. Point both at the local database (`DATABASE_URL` in `.env`).
- After schema changes, use `pnpm db:migrate`. `pnpm db:setup` recreates the
  local database and Keycloak from scratch.

## Working with the owner

The owner validates product and architecture decisions before large changes.
Present the analysis and a plan for approval before rebuilding anything.

## Current state

- **Work in progress:** everything on branch `feat/simulation-workspace` is
  uncommitted and unpushed, and `pnpm check` passes.
- **Never in production:** the project has no users and no data to preserve.
  Nothing here, including the schema, migrations, API contracts and frontend,
  needs backward compatibility. Any part can be redesigned or rebuilt.
- **Disposable data:** the local Docker PostgreSQL and Keycloak hold no data
  worth keeping, per the user.
- **No commits or branch changes:** do not commit, or create or switch
  branches, without the user's explicit request.
