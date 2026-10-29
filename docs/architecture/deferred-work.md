# Deferred Work

Work that was consciously postponed but must still be implemented. Each item
says why it was deferred, what exists today, and what "done" means. Remove an
item when it ships.

## Recalculation status on screen (deferred 2026-10-26)

- **Today:** fan-out writes no calculation rows, so a
  simulation waiting for the recalculation of a premise change shows the
  derived "Desatualizado" until its new result lands, never "Calculando",
  and keeps its own last cause. A failed premise recalculation already shows
  "Falha técnica" (`recalculation.md`).
- **Why deferred:** the recalculation lands within seconds, and the user who
  changed the offer or curve was told before saving how many simulations
  would be recalculated. Showing "Calculando" needs the fact that a
  recalculation is queued stored somewhere; an event-kept projection and
  fan-out writing `PENDING` were both rejected on 2026-10-29 as too heavy for
  those seconds.
- **Revisit with** the [BCB Rate Import](../product/planned/bcb-rate-import.md),
  when system curves change without the user.
- **Done when** the screens say a simulation is being recalculated because
  its offer or curve changed.

## Composed screen reads without one snapshot (deferred 2026-10-28)

- **Today:** the investment plan details, the simulation comparison, the
  simulation workspace, and the simulation list run their domain read (a read
  use case or `SimulationResultValidityReader`) and their own screen read as
  separate statements outside a transaction (`@SkipTransaction()`), so a
  calculation committed between them can rank or total a result other than
  the one shown, or show a status that disagrees with `isSettled`. The
  comparison polls only while a shown status is `PENDING`, so it can stay
  inconsistent until the next load; the workspace polls every 3 seconds.
- **Why deferred:** the window is one round trip, and closing it needs a
  read-only `REPEATABLE READ` mode for the unit of work, a change of its own.
- **Revisit when** users report a verdict or total that disagrees with the
  figures shown, or another screen composes reads this way.
- **Done when** a composed screen read sees one snapshot.

## Creating a private offer and its simulation in one transaction (deferred 2026-10-27)

- **Today:** "Digitar termos" and "Duplicar e ajustar" save the new private
  offer and the simulation in one use case and one transaction
  (`create-simulation.use-case.ts:59-61`), two aggregates where the rule is
  one.
- **Why deferred:** found while planning investment plans, whose design
  follows the rule; changing the create flow is outside that work.
- **Revisit with:** the one-aggregate rule in `investflow-domain-application`:
  either a user-visible step (create the offer, then the simulation) or an
  eventual step, and how the screen recovers when the second step fails.
- **Done when** each use case changes one aggregate, or the exception is
  justified and recorded.
