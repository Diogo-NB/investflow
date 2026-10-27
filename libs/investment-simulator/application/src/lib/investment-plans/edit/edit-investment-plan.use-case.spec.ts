import { EAppErrorCode } from '@investflow/shared-domain';
import {
  investmentPlanFixture,
  OTHER_OWNER,
  OWNER,
} from '../shared/investment-plan-fixture';
import { EditInvestmentPlanCommand } from './edit-investment-plan.command';
import { EditInvestmentPlanUseCase } from './edit-investment-plan.use-case';

function setup() {
  const fixture = investmentPlanFixture(jest.fn);
  return {
    ...fixture,
    useCase: new EditInvestmentPlanUseCase(fixture.planRepository),
  };
}

const edit = (
  ownerId: string,
  investmentPlanId: string,
  request: { revision: number; name?: string; description?: string | null },
) =>
  EditInvestmentPlanCommand.fromRequest(ownerId, { investmentPlanId }, request);

describe('EditInvestmentPlanUseCase', () => {
  it('renames the plan and answers its new revision', async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan();

    const result = await useCase.execute(
      edit(OWNER, plan.id, { revision: 1, name: 'Aposentadoria' }),
    );

    expect(result.value).toEqual({ revision: 2 });
    expect(plan.name).toBe('Aposentadoria');
  });

  it('rejects an edit from a stale revision', async () => {
    const { useCase, givenPlan, planRepository } = setup();
    const plan = givenPlan();
    await planRepository.save(plan.addSimulations(['simulation-1']).value);
    jest.mocked(planRepository.save).mockClear();

    const result = await useCase.execute(
      edit(OWNER, plan.id, { revision: 1, name: 'Aposentadoria' }),
    );

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_REVISION_CONFLICT,
    );
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("reports another owner's plan as missing", async () => {
    const { useCase, givenPlan } = setup();
    const plan = givenPlan(OTHER_OWNER);

    const result = await useCase.execute(
      edit(OWNER, plan.id, { revision: 1, name: 'Minha' }),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
    expect(plan.name).toBe('Reserva');
  });

  it('rejects a blank name', async () => {
    const { useCase, givenPlan, planRepository } = setup();
    const plan = givenPlan();

    const result = await useCase.execute(
      edit(OWNER, plan.id, { revision: 1, name: '  ' }),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_INVALID);
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});
