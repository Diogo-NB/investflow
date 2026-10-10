import {
  CalculateSimulationUseCase,
  DeleteSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { Result } from '@investflow/shared-domain';
import { ListCalculationMonthlyBalancesQueryHandler } from '../queries/list-calculation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { CreateSimulationRequest } from './requests/create-simulation.request';
import { ListSimulationsRequest } from './requests/list-simulations.request';
import { SimulationController } from './simulation.controller';

jest.mock('@investflow/shared-infrastructure', () => ({
  CurrentUser: () => () => undefined,
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

const USER = { userId: 'owner-id', email: 'owner@example.com' };
const SIMULATION_ID = 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11';
const CALCULATION_ID = 'c0a1f6a2-1d4e-4c55-8f0e-5b8f3f2d9a10';

function handler<T>() {
  return { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as T & {
    execute: jest.Mock;
  };
}

function createFixture() {
  const calculate = handler<CalculateSimulationUseCase>();
  const remove = handler<DeleteSimulationUseCase>();
  const list = handler<ListSimulationsQueryHandler>();
  const balances = handler<ListCalculationMonthlyBalancesQueryHandler>();
  return {
    controller: new SimulationController(calculate, remove, list, balances),
    calculate,
    remove,
    list,
    balances,
  };
}

function createRequest() {
  return Object.assign(new CreateSimulationRequest(), {
    offerId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
    principal: '1000.50',
    investmentDate: '2026-01-02',
    indexCurveId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
    issuerId: '6f1c1c55-61a1-4e3f-9b8a-1d1d6a9b2f10',
    maturityDate: '2028-01-03',
    redemptionTerms: { kind: 'DAILY' as const },
    remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate: '1.1' },
  });
}

describe('SimulationController', () => {
  it('scopes the reads to the authenticated owner', async () => {
    const fixture = createFixture();

    await fixture.controller.list(USER, new ListSimulationsRequest());
    await fixture.controller.monthlyBalances(USER, {
      calculationId: CALCULATION_ID,
    });

    expect(fixture.list.execute).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      ownerId: USER.userId,
    });
    expect(fixture.balances.execute).toHaveBeenCalledWith({
      calculationId: CALCULATION_ID,
      ownerId: USER.userId,
    });
  });

  it('builds owned commands from the request', async () => {
    const fixture = createFixture();
    const request = createRequest();

    await fixture.controller.create(USER, request);
    await fixture.controller.calculate(
      USER,
      { simulationId: SIMULATION_ID },
      request,
    );
    await fixture.controller.delete(USER, { simulationId: SIMULATION_ID });

    const created = fixture.calculate.execute.mock.calls[0][0];
    expect(created.ownerId).toBe(USER.userId);
    expect(created.target).toEqual({ sourceOfferId: request.offerId });
    expect(created.inputs.principal.amount.toString()).toBe('1000.5');
    expect(created.inputs.indexCurveId).toBe(request.indexCurveId);
    const calculated = fixture.calculate.execute.mock.calls[1][0];
    expect(calculated.target).toEqual({ simulationId: SIMULATION_ID });
    const deleted = fixture.remove.execute.mock.calls[0][0];
    expect(deleted).toMatchObject({
      ownerId: USER.userId,
      simulationId: SIMULATION_ID,
    });
  });
});
