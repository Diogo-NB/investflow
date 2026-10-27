import { SimulationCalculationRequested } from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  DomainEventRecorder,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { RecalculateOfferSimulationsCommand } from './recalculate-offer-simulations.command';
import { RecalculateOfferSimulationsUseCase } from './recalculate-offer-simulations.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup(ids: Result<string[], AppError>) {
  const simulations = {
    idsUsingOffer: jest.fn().mockResolvedValue(ids),
  } as unknown as jest.Mocked<SimulationRepository>;
  const events = { record: jest.fn() } as jest.Mocked<DomainEventRecorder>;
  const useCase = new RecalculateOfferSimulationsUseCase(simulations, events, {
    now: () => NOW,
  } as unknown as Clock);
  const execute = () =>
    useCase.execute(RecalculateOfferSimulationsCommand.of('offer-id'));
  return { simulations, events, execute };
}

describe('RecalculateOfferSimulationsUseCase', () => {
  it('requests one calculation per simulation using the offer', async () => {
    const { simulations, events, execute } = setup(Result.ok(['a', 'b']));

    expect((await execute()).isOk()).toBe(true);

    expect(simulations.idsUsingOffer).toHaveBeenCalledWith('offer-id');
    expect(events.record).toHaveBeenCalledTimes(1);
    const requested = events.record.mock.calls[0];
    expect(requested).toEqual([
      expect.any(SimulationCalculationRequested),
      expect.any(SimulationCalculationRequested),
    ]);
    expect(requested.map((event) => event.aggregateId)).toEqual(['a', 'b']);
    expect(requested[0].occurredAt).toBe(NOW);
  });

  it('requests nothing when no simulation uses the offer', async () => {
    const { events, execute } = setup(Result.ok([]));

    expect((await execute()).isOk()).toBe(true);
    expect(events.record).toHaveBeenCalledWith();
  });

  it('returns a failed lookup so the queue retries', async () => {
    const failure = new AppError('Falhou.', {
      code: EAppErrorCode.REPOSITORY_FIND_FAILED,
      kind: 'infrastructure',
    });
    const { events, execute } = setup(Result.err(failure));

    expect((await execute()).error).toBe(failure);
    expect(events.record).not.toHaveBeenCalled();
  });
});
