import { ETitleType } from '@investflow/investment-simulator-domain';
import {
  CreateSimulationUseCase,
  DeleteSimulationUseCase,
  EditSimulationUseCase,
  RecalculateSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { Result } from '@investflow/shared-domain';
import { ListSimulationMonthlyBalancesQueryHandler } from '../queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { CreateSimulationRequest } from './requests/create-simulation.request';
import { EditSimulationRequest } from './requests/edit-simulation.request';
import { ListSimulationsRequest } from './requests/list-simulations.request';
import { SimulationController } from './simulation.controller';

jest.mock('@investflow/shared-infrastructure', () => ({
  CurrentUser: () => () => undefined,
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

const USER = { userId: 'owner-id', email: 'owner@example.com' };
const SIMULATION_ID = 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11';
const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function handler<T>() {
  return { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as T & {
    execute: jest.Mock;
  };
}

function createFixture() {
  const create = handler<CreateSimulationUseCase>();
  const edit = handler<EditSimulationUseCase>();
  const remove = handler<DeleteSimulationUseCase>();
  const recalculate = handler<RecalculateSimulationUseCase>();
  const list = handler<ListSimulationsQueryHandler>();
  const balances = handler<ListSimulationMonthlyBalancesQueryHandler>();
  return {
    controller: new SimulationController(
      create,
      edit,
      remove,
      recalculate,
      list,
      balances,
    ),
    create,
    edit,
    remove,
    recalculate,
    list,
    balances,
  };
}

const INVESTMENT = {
  principal: '1000.50',
  investmentDate: '2026-01-02',
  curveId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
};

describe('SimulationController', () => {
  it('scopes the reads to the authenticated owner', async () => {
    const fixture = createFixture();

    await fixture.controller.list(USER, new ListSimulationsRequest());
    await fixture.controller.monthlyBalances(USER, {
      simulationId: SIMULATION_ID,
    });

    expect(fixture.list.execute).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      ownerId: USER.userId,
    });
    expect(fixture.balances.execute).toHaveBeenCalledWith({
      simulationId: SIMULATION_ID,
      ownerId: USER.userId,
    });
  });

  it('builds owned commands from the request', async () => {
    const fixture = createFixture();

    await fixture.controller.create(
      USER,
      Object.assign(new CreateSimulationRequest(), {
        offer: {
          new: {
            titleType: ETitleType.LCA,
            name: 'LCA digitada',
            maturityDate: '2028-01-03',
            redemptionTerms: { kind: 'DAILY' as const },
            remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate: '1.1' },
          },
        },
        investment: INVESTMENT,
      }),
    );
    await fixture.controller.edit(
      USER,
      { simulationId: SIMULATION_ID },
      Object.assign(new EditSimulationRequest(), {
        revision: 2,
        offer: { id: OFFER_ID },
        investment: INVESTMENT,
      }),
    );
    await fixture.controller.delete(USER, { simulationId: SIMULATION_ID });
    await fixture.controller.recalculate(USER, {
      simulationId: SIMULATION_ID,
    });

    const created = fixture.create.execute.mock.calls[0][0];
    expect(created.ownerId).toBe(USER.userId);
    expect(created.offer.kind).toBe('new');
    expect(created.offer.offer.actorId).toBe(USER.userId);
    expect(created.offer.offer.titleType).toBe(ETitleType.LCA);
    expect(created.investment.principal.amount.toString()).toBe('1000.5');
    const edited = fixture.edit.execute.mock.calls[0][0];
    expect(edited).toMatchObject({
      ownerId: USER.userId,
      simulationId: SIMULATION_ID,
      revision: 2,
      offer: { kind: 'existing', offerId: OFFER_ID },
    });
    expect(edited.investment.curveId).toBe(INVESTMENT.curveId);
    for (const owned of [fixture.remove, fixture.recalculate]) {
      expect(owned.execute.mock.calls[0][0]).toMatchObject({
        ownerId: USER.userId,
        simulationId: SIMULATION_ID,
      });
    }
  });
});
