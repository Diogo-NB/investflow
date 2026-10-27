import { EAppErrorCode } from '@investflow/shared-domain';
import {
  investmentPlanFixture,
  OWNER,
} from '../shared/investment-plan-fixture';
import { CreateInvestmentPlanCommand } from './create-investment-plan.command';
import { CreateInvestmentPlanUseCase } from './create-investment-plan.use-case';

function setup() {
  const fixture = investmentPlanFixture(jest.fn);
  return {
    ...fixture,
    useCase: new CreateInvestmentPlanUseCase(fixture.planRepository),
  };
}

describe('CreateInvestmentPlanUseCase', () => {
  it('saves an empty plan for the owner', async () => {
    const { useCase, planRepository } = setup();

    const result = await useCase.execute(
      CreateInvestmentPlanCommand.fromRequest(OWNER, {
        name: 'Reserva',
        description: 'Curto prazo',
      }),
    );

    const [plan] = jest.mocked(planRepository.save).mock.calls[0];
    expect(result.value).toEqual({ investmentPlanId: plan.id });
    expect(plan.ownerId).toBe(OWNER);
    expect(plan.description).toBe('Curto prazo');
    expect(plan.simulationIds).toEqual([]);
  });

  it('rejects a plan without a name', async () => {
    const { useCase, planRepository } = setup();

    const result = await useCase.execute(
      CreateInvestmentPlanCommand.fromRequest(OWNER, { name: ' ' }),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_INVALID);
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});
