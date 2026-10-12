import { AppError, EAppErrorCode, Result } from '@investflow/shared-domain';
import { SimulationCalculationFailureConsumer } from './simulation-calculation-failure.consumer';
import { SimulationCalculationConsumer } from './simulation-calculation.consumer';

jest.mock('@investflow/shared-infrastructure', () => ({
  OnEvent: () => () => undefined,
}));

const FAILURE = new AppError('Falhou.', {
  code: EAppErrorCode.REPOSITORY_SAVE_FAILED,
  kind: 'unexpected',
});

type Handler = (payload: Record<string, unknown>) => Promise<void>;
type Consumer = Record<
  'onCreated' | 'onEdited' | 'onCalculationRequested',
  Handler
>;

const CONSUMERS: readonly [string, (useCase: never) => Consumer][] = [
  [
    'SimulationCalculationConsumer',
    (useCase) => new SimulationCalculationConsumer(useCase),
  ],
  [
    'SimulationCalculationFailureConsumer',
    (useCase) => new SimulationCalculationFailureConsumer(useCase),
  ],
];

const HANDLERS = [
  ['onCreated', 'SimulationCreated'],
  ['onEdited', 'SimulationEdited'],
  ['onCalculationRequested', 'SimulationCalculationRequested'],
] as const;

describe.each(CONSUMERS)('%s', (_, build) => {
  function setup(result: Result<void, AppError>) {
    const useCase = { execute: jest.fn().mockResolvedValue(result) };
    return { useCase, consumer: build(useCase as never) };
  }

  it.each(HANDLERS)(
    'runs the use case for the simulation of %s',
    async (handler, eventType) => {
      const { useCase, consumer } = setup(Result.ok(undefined));

      await consumer[handler]({ eventType, aggregateId: 'simulation-id' });

      expect(useCase.execute).toHaveBeenCalledWith({
        simulationId: 'simulation-id',
      });
    },
  );

  it('throws a failure so the queue retries the message', async () => {
    const { consumer } = setup(Result.err(FAILURE));

    await expect(
      consumer.onEdited({ aggregateId: 'simulation-id' }),
    ).rejects.toBe(FAILURE);
  });

  it('throws on a payload without the simulation', async () => {
    const { useCase, consumer } = setup(Result.ok(undefined));

    await expect(
      consumer.onCreated({ eventType: 'SimulationCreated' }),
    ).rejects.toThrow();
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});
