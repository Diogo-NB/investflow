import {
  ESimulationCalculationStatus,
  InvestmentPlanTotalsCalculator,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  EAppErrorCode,
  Result,
} from '@investflow/shared-domain';
import { OTHER_OWNER, OWNER } from '../shared/investment-plan-fixture';
import {
  memberReader,
  planMember,
} from '../shared/investment-plan-member-fixture';
import { BuildInvestmentPlanTotalsQuery } from './build-investment-plan-totals.query';
import { BuildInvestmentPlanTotalsUseCase } from './build-investment-plan-totals.use-case';

const clock = { today: () => CalendarDate.of('2026-10-28') } as Clock;

function setup(
  plans: Parameters<typeof memberReader>[1] = {
    plan: {
      ownerId: OWNER,
      members: [
        planMember({ maturityDate: '2026-10-01' }),
        planMember({ maturityDate: '2026-10-30' }),
        planMember({
          calculationStatus: ESimulationCalculationStatus.INVALID,
          hasResult: false,
        }),
      ],
    },
  },
) {
  const reader = memberReader(jest.fn, plans);
  return {
    reader,
    useCase: new BuildInvestmentPlanTotalsUseCase(
      reader,
      new InvestmentPlanTotalsCalculator(),
      clock,
    ),
  };
}

describe('BuildInvestmentPlanTotalsUseCase', () => {
  it("totals the plan's members as of today", async () => {
    const { useCase, reader } = setup();

    const totals = (
      await useCase.execute(BuildInvestmentPlanTotalsQuery.of(OWNER, 'plan'))
    ).value;

    expect(reader.findByPlans).toHaveBeenCalledWith(OWNER, ['plan']);
    expect(totals?.excludedSimulationCount).toBe(1);
    expect(totals?.principal.amount.toFixed()).toBe('2000');
    expect(totals?.maturityMonths).toEqual([
      expect.objectContaining({
        simulationCount: 2,
        maturedSimulationCount: 1,
      }),
    ]);
  });

  it('has no totals while no member has a result', async () => {
    const { useCase } = setup({
      plan: { ownerId: OWNER, members: [planMember({ hasResult: false })] },
    });

    const result = await useCase.execute(
      BuildInvestmentPlanTotalsQuery.of(OWNER, 'plan'),
    );

    expect(result.isOk()).toBe(true);
    expect(result.value).toBeNull();
  });

  it.each([
    ["another owner's plan", OTHER_OWNER, 'plan'],
    ['a missing or deleted plan', OWNER, 'gone'],
  ])('reports %s as missing', async (_, ownerId, investmentPlanId) => {
    const { useCase } = setup();

    const result = await useCase.execute(
      BuildInvestmentPlanTotalsQuery.of(ownerId, investmentPlanId),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
  });

  it('passes a failed read on', async () => {
    const { useCase, reader } = setup();
    const failure = Result.err(
      new AppError('Não foi possível carregar os planos.', {
        code: EAppErrorCode.INVESTMENT_PLAN_QUERY_FAILED,
        kind: 'infrastructure',
      }),
    );
    jest.mocked(reader.findByPlans).mockResolvedValueOnce(failure);

    expect(
      await useCase.execute(BuildInvestmentPlanTotalsQuery.of(OWNER, 'plan')),
    ).toBe(failure);
  });
});
