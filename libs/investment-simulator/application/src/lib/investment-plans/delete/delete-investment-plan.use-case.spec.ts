import { EAppErrorCode } from '@investflow/shared-domain';
import {
  investmentPlanFixture,
  NOW,
  OTHER_OWNER,
  OWNER,
} from '../shared/investment-plan-fixture';
import { DeleteInvestmentPlanCommand } from './delete-investment-plan.command';
import { DeleteInvestmentPlanUseCase } from './delete-investment-plan.use-case';

function setup() {
  const fixture = investmentPlanFixture(jest.fn);
  return {
    ...fixture,
    useCase: new DeleteInvestmentPlanUseCase(
      fixture.planRepository,
      fixture.clock,
    ),
  };
}

describe('DeleteInvestmentPlanUseCase', () => {
  it('soft deletes the plan', async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan(OWNER, ['simulation-1']);

    const result = await useCase.execute(
      DeleteInvestmentPlanCommand.fromRequest(OWNER, {
        investmentPlanId: plan.id,
      }),
    );

    expect(result.isOk()).toBe(true);
    expect(plan.deletedAt).toBe(NOW);
  });

  it.each([
    ["another owner's plan", OTHER_OWNER],
    ['a deleted plan', OWNER],
  ])('reports %s as missing', async (_, owner) => {
    const { useCase, givenPlan, planRepository } = setup();
    const plan = givenPlan(owner);
    if (owner === OWNER) await planRepository.save(plan.delete(NOW));
    jest.mocked(planRepository.save).mockClear();

    const result = await useCase.execute(
      DeleteInvestmentPlanCommand.fromRequest(OWNER, {
        investmentPlanId: plan.id,
      }),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});
