import { EAppErrorCode } from '@investflow/shared-domain';
import {
  investmentPlanFixture,
  OTHER_OWNER,
  OWNER,
} from '../shared/investment-plan-fixture';
import { RemoveInvestmentPlanSimulationCommand } from './remove-investment-plan-simulation.command';
import { RemoveInvestmentPlanSimulationUseCase } from './remove-investment-plan-simulation.use-case';

function setup() {
  const fixture = investmentPlanFixture(jest.fn);
  return {
    ...fixture,
    useCase: new RemoveInvestmentPlanSimulationUseCase(fixture.planRepository),
  };
}

const remove = (ownerId: string, investmentPlanId: string, id: string) =>
  RemoveInvestmentPlanSimulationCommand.fromRequest(ownerId, {
    investmentPlanId,
    simulationId: id,
  });

describe('RemoveInvestmentPlanSimulationUseCase', () => {
  it('removes the simulation from the plan only', async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan(OWNER, ['a', 'b']);

    const result = await useCase.execute(remove(OWNER, plan.id, 'a'));

    expect(result.isOk()).toBe(true);
    expect(plan.simulationIds).toEqual(['b']);
  });

  it('succeeds when the simulation already left the plan', async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan(OWNER, ['b']);

    const result = await useCase.execute(remove(OWNER, plan.id, 'a'));

    expect(result.isOk()).toBe(true);
    expect(plan.revision).toBe(1);
  });

  it("reports another owner's plan as missing", async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan(OTHER_OWNER, ['a']);

    const result = await useCase.execute(remove(OWNER, plan.id, 'a'));

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
    expect(plan.simulationIds).toEqual(['a']);
  });
});
