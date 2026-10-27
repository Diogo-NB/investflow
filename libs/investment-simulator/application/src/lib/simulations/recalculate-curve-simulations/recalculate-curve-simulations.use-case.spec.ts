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
import { RecalculateCurveSimulationsCommand } from './recalculate-curve-simulations.command';
import { RecalculateCurveSimulationsUseCase } from './recalculate-curve-simulations.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup(ids: Result<string[], AppError>) {
  const simulations = {
    findIdsByCurve: jest.fn().mockResolvedValue(ids),
  } as unknown as jest.Mocked<SimulationRepository>;
  const events = { record: jest.fn() } as jest.Mocked<DomainEventRecorder>;
  const useCase = new RecalculateCurveSimulationsUseCase(simulations, events, {
    now: () => NOW,
  } as unknown as Clock);
  const execute = () =>
    useCase.execute(RecalculateCurveSimulationsCommand.of('curve-id'));
  return { simulations, events, execute };
}

describe('RecalculateCurveSimulationsUseCase', () => {
  it('requests one calculation per simulation using the curve', async () => {
    const { simulations, events, execute } = setup(Result.ok(['a', 'b']));

    expect((await execute()).isOk()).toBe(true);

    expect(simulations.findIdsByCurve).toHaveBeenCalledWith('curve-id');
    expect(events.record).toHaveBeenCalledTimes(1);
    const requested = events.record.mock.calls[0];
    expect(requested).toEqual([
      expect.any(SimulationCalculationRequested),
      expect.any(SimulationCalculationRequested),
    ]);
    expect(requested.map((event) => event.aggregateId)).toEqual(['a', 'b']);
    expect(requested[0].occurredAt).toBe(NOW);
  });

  it('requests nothing when no simulation uses the curve', async () => {
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
