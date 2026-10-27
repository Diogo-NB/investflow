// An in-memory plan and simulation repository shared by the plan use-case
// specs.
import { InvestmentPlan } from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { Result, UtcInstant } from '@investflow/shared-domain';
import { SimulationRepository } from '../../simulations/simulation.repository';
import { InvestmentPlanNotFoundError } from '../investment-plan-not-found.error';
import { InvestmentPlanRepository } from '../investment-plan.repository';

export const OWNER = 'user-1';
export const OTHER_OWNER = 'user-2';
export const NOW = UtcInstant.ofIso('2026-10-27T12:00:00Z');

// Specs pass jest.fn, which the library build cannot reference.
type Spy = <F extends (...args: never[]) => unknown>(implementation: F) => F;

export function investmentPlanFixture(spy: Spy) {
  const plans = new Map<string, InvestmentPlan>();
  // The live simulations by owner.
  const simulationOwners = new Map<string, string>();

  const find = (id: string, ownerId?: string) => {
    const plan = plans.get(id);
    return plan &&
      !plan.deletedAt &&
      (ownerId === undefined || plan.ownerId === ownerId)
      ? Result.ok(plan)
      : Result.err(new InvestmentPlanNotFoundError(id));
  };

  const planRepository = {
    findById: spy(async (id: string) => find(id)),
    findOwned: spy(async (id: string, ownerId: string) => find(id, ownerId)),
    save: spy(async (plan: InvestmentPlan) => {
      plans.set(plan.id, plan);
      plan.markPersisted();
      return Result.ok(undefined);
    }),
  } satisfies InvestmentPlanRepository;

  const simulationRepository = {
    findIdsOwnedBy: spy(async (ownerId: string, ids: readonly string[]) =>
      Result.ok(ids.filter((id) => simulationOwners.get(id) === ownerId)),
    ),
  } as unknown as SimulationRepository;

  const clock = { now: () => NOW } as unknown as Clock;

  // Stores a plan without recording the save.
  function givenPlan(
    ownerId = OWNER,
    simulationIds: readonly string[] = [],
  ): InvestmentPlan {
    const plan = InvestmentPlan.create({ ownerId, name: 'Reserva' }).value;
    plan.addSimulations(simulationIds);
    plans.set(plan.id, plan.markPersisted());
    return plan;
  }

  function givenSimulations(ownerId: string, ...ids: string[]) {
    for (const id of ids) simulationOwners.set(id, ownerId);
  }

  return {
    planRepository,
    simulationRepository,
    clock,
    givenPlan,
    givenSimulations,
  };
}
