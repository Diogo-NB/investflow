import { InvestmentPlan } from '@investflow/investment-simulator-domain';
import { EAppErrorCode } from '@investflow/shared-domain';
import {
  investmentPlanFixture,
  NOW,
  OTHER_OWNER,
  OWNER,
} from '../shared/investment-plan-fixture';
import { AddInvestmentPlanSimulationsCommand } from './add-investment-plan-simulations.command';
import { AddInvestmentPlanSimulationsUseCase } from './add-investment-plan-simulations.use-case';

function setup() {
  const fixture = investmentPlanFixture(jest.fn);
  return {
    ...fixture,
    useCase: new AddInvestmentPlanSimulationsUseCase(
      fixture.planRepository,
      fixture.simulationRepository,
    ),
  };
}

const add = (investmentPlanId: string, simulationIds: string[]) =>
  AddInvestmentPlanSimulationsCommand.fromRequest(
    OWNER,
    { investmentPlanId },
    { simulationIds },
  );

describe('AddInvestmentPlanSimulationsUseCase', () => {
  it("adds the owner's simulations to the plan", async () => {
    const { useCase, givenPlan, givenSimulations, simulationRepository } =
      setup();
    const plan = givenPlan(OWNER, ['a']);
    givenSimulations(OWNER, 'a', 'b', 'c');

    const result = await useCase.execute(add(plan.id, ['a', 'b', 'c']));

    expect(result.isOk()).toBe(true);
    expect(plan.simulationIds).toEqual(['a', 'b', 'c']);
    expect(simulationRepository.findIdsOwnedBy).toHaveBeenCalledWith(OWNER, [
      'a',
      'b',
      'c',
    ]);
  });

  it('changes nothing when repeated', async () => {
    const { useCase, givenPlan, givenSimulations } = setup();
    const plan = givenPlan(OWNER, ['a']);
    givenSimulations(OWNER, 'a');

    expect((await useCase.execute(add(plan.id, ['a']))).isOk()).toBe(true);

    expect(plan.revision).toBe(1);
  });

  it.each([
    ["another owner's simulation", OTHER_OWNER],
    ['a deleted or unknown simulation', null],
  ])('reports %s as missing', async (_, owner) => {
    const { useCase, givenPlan, givenSimulations, planRepository } = setup();
    const plan = givenPlan();
    givenSimulations(OWNER, 'a');
    if (owner) givenSimulations(owner, 'b');

    const result = await useCase.execute(add(plan.id, ['a', 'b']));

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
    expect(result.error.metadata).toEqual({ simulationId: 'b' });
    expect(plan.simulationIds).toEqual([]);
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    ["another owner's plan", OTHER_OWNER],
    ['a deleted plan', OWNER],
  ])('reports %s as missing', async (_, owner) => {
    const { useCase, givenPlan, givenSimulations, planRepository } = setup();
    const plan = givenPlan(owner);
    if (owner === OWNER) await planRepository.save(plan.delete(NOW));
    givenSimulations(OWNER, 'a');

    const result = await useCase.execute(add(plan.id, ['a']));

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
  });

  it('rejects passing the limit', async () => {
    const { useCase, givenPlan, givenSimulations, planRepository } = setup();
    const members = Array.from(
      { length: InvestmentPlan.SIMULATION_LIMIT },
      (_, i) => `member-${i}`,
    );
    const plan = givenPlan(OWNER, members);
    givenSimulations(OWNER, 'extra');

    const result = await useCase.execute(add(plan.id, ['extra']));

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_SIMULATION_LIMIT,
    );
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});
