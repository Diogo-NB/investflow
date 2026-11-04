import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveNotFoundError } from '../curve-not-found.error';
import { CurveRepository } from '../curve.repository';
import { ApplyPublishedIndexValuesCommand } from './apply-published-index-values.command';
import { ApplyPublishedIndexValuesUseCase } from './apply-published-index-values.use-case';

const curve = () =>
  Curve.reconstitute({
    id: 'curve-1',
    index: EEconomicIndex.SELIC,
    ownerId: null,
    name: 'SELIC',
    description: null,
    revision: 1,
    valuesRevision: 1,
    deletedAt: null,
    intervals: [
      CurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-09-17'),
          CalendarDate.of('2026-10-30'),
        ),
        IndexValue.of('0.1365'),
      ),
    ],
  });

function setup(found: Result<Curve, AppError>) {
  const findSystemCurve = jest.fn().mockResolvedValue(found);
  const save = jest.fn().mockResolvedValue(Result.ok(undefined));
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2026-11-04T13:00:00.000Z'),
    today: () => CalendarDate.of('2026-11-04'),
  };
  const useCase = new ApplyPublishedIndexValuesUseCase(
    { findSystemCurve, save } as unknown as CurveRepository,
    clock,
  );
  return { useCase, findSystemCurve, save };
}

const command = ApplyPublishedIndexValuesCommand.fromRequest({
  index: 'SELIC',
  values: [{ referenceDate: '2026-11-03', value: '0.1365' }],
});

describe('ApplyPublishedIndexValuesUseCase', () => {
  it('finds the system curve by index and name, applies, and saves', async () => {
    const found = curve();
    const { useCase, findSystemCurve, save } = setup(Result.ok(found));

    const result = await useCase.execute(command);

    expect(result.isOk()).toBe(true);
    expect(findSystemCurve).toHaveBeenCalledWith(EEconomicIndex.SELIC, 'SELIC');
    expect(found.lastInterval.range.end.toIsoString()).toBe('2026-11-03');
    expect(save).toHaveBeenCalledWith(found);
  });

  it('reports a missing curve and saves nothing', async () => {
    const { useCase, save } = setup(
      Result.err(new CurveNotFoundError('SELIC')),
    );

    const result = await useCase.execute(command);

    expect(result.error.code).toBe(EAppErrorCode.CURVE_NOT_FOUND);
    expect(save).not.toHaveBeenCalled();
  });
});
