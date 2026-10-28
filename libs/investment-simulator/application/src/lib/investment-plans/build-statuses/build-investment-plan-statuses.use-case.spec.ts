import { ESimulationCalculationStatus } from '@investflow/investment-simulator-domain';
import { OTHER_OWNER, OWNER } from '../shared/investment-plan-fixture';
import {
  memberReader,
  planMember,
} from '../shared/investment-plan-member-fixture';
import { BuildInvestmentPlanStatusesQuery } from './build-investment-plan-statuses.query';
import { BuildInvestmentPlanStatusesUseCase } from './build-investment-plan-statuses.use-case';

function setup() {
  const reader = memberReader(jest.fn, {
    settled: { ownerId: OWNER, members: [planMember(), planMember()] },
    calculating: {
      ownerId: OWNER,
      members: [
        planMember(),
        planMember({ calculationStatus: ESimulationCalculationStatus.PENDING }),
      ],
    },
    empty: { ownerId: OWNER, members: [] },
    theirs: { ownerId: OTHER_OWNER, members: [planMember()] },
  });
  return { reader, useCase: new BuildInvestmentPlanStatusesUseCase(reader) };
}

describe('BuildInvestmentPlanStatusesUseCase', () => {
  it("builds each of the owner's plans' status from one read", async () => {
    const { useCase, reader } = setup();
    const ids = ['settled', 'calculating', 'empty', 'theirs'];

    const statuses = (
      await useCase.execute(BuildInvestmentPlanStatusesQuery.of(OWNER, ids))
    ).value;

    expect(reader.findByPlans).toHaveBeenCalledTimes(1);
    expect([...statuses.keys()]).toEqual(['settled', 'calculating', 'empty']);
    expect(statuses.get('settled')?.isSettled).toBe(true);
    expect(statuses.get('calculating')?.calculatingCount).toBe(1);
    expect(statuses.get('empty')?.isSettled).toBe(true);
  });
});
