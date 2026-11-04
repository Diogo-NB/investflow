import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import {
  AppError,
  CalendarDate,
  EAppErrorCode,
  Result,
} from '@investflow/shared-domain';
import { PublishedIndexValuesConsumer } from './published-index-values.consumer';

jest.mock('@investflow/shared-infrastructure', () => ({
  OnEvent: () => () => undefined,
}));

const payload = {
  aggregateId: 'series-1',
  index: 'SELIC',
  values: [{ referenceDate: '2026-11-03', value: '0.1365' }],
};

function setup(result: Result<void, AppError> = Result.ok(undefined)) {
  const useCase = { execute: jest.fn().mockResolvedValue(result) };
  return {
    useCase,
    consumer: new PublishedIndexValuesConsumer(useCase as never),
  };
}

describe('PublishedIndexValuesConsumer', () => {
  it('applies the values in the payload', async () => {
    const { useCase, consumer } = setup();

    await consumer.onPublishedIndexValuesImported(payload);

    const command = useCase.execute.mock.calls[0][0];
    expect(command.index).toBe(EEconomicIndex.SELIC);
    expect(command.values[0].referenceDate).toEqual(
      CalendarDate.of('2026-11-03'),
    );
    expect(command.values[0].value.value.toFixed()).toBe('0.1365');
  });

  it('applies nothing for the target SELIC, which feeds no curve', async () => {
    const { useCase, consumer } = setup();

    await consumer.onPublishedIndexValuesImported({
      ...payload,
      index: 'SELIC_TARGET',
    });

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown index', { ...payload, index: 'IPCA' }],
    ['no values', { index: 'CDI' }],
    [
      'a malformed date',
      { index: 'CDI', values: [{ referenceDate: '03/11/2026', value: '0.1' }] },
    ],
  ])('throws on %s, without applying anything', async (_, invalid) => {
    const { useCase, consumer } = setup();

    await expect(
      consumer.onPublishedIndexValuesImported(invalid),
    ).rejects.toThrow();
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('throws a failed use case so the queue retries it', async () => {
    const failure = new AppError('Falhou.', {
      code: EAppErrorCode.CURVE_REVISION_CONFLICT,
      kind: 'conflict',
    });
    const { consumer } = setup(Result.err(failure));

    await expect(consumer.onPublishedIndexValuesImported(payload)).rejects.toBe(
      failure,
    );
  });
});
