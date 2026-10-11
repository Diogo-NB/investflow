import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { curveFixture, USER } from '../shared/curve-fixture';
import { CreateCurveCommand } from './create-curve.command';
import { CreateCurveUseCase } from './create-curve.use-case';

function command(
  overrides: Partial<Parameters<typeof CreateCurveCommand.fromRequest>[1]> = {},
  actorId: string | null = USER,
) {
  return CreateCurveCommand.fromRequest(actorId, {
    index: EEconomicIndex.SELIC,
    name: 'Minha SELIC',
    intervals: [
      { startDate: '2026-11-01', endDate: '2026-11-30', value: '0.11' },
      { startDate: '2026-10-01', endDate: '2026-10-31', value: '0.12' },
    ],
    ...overrides,
  });
}

describe('CreateCurveUseCase', () => {
  it('converts the request intervals', () => {
    const created = command();
    expect(created.actorId).toBe(USER);
    expect(created.description).toBeNull();
    expect(created.intervals[0].range.start.toIsoString()).toBe('2026-11-01');
    expect(created.intervals[0].value.value.toString()).toBe('0.11');
  });

  it.each([USER, null])(
    'saves a curve owned by %s with its creation event',
    async (actorId) => {
      const fixture = curveFixture(jest.fn);
      const useCase = new CreateCurveUseCase(
        fixture.curveRepository,
        fixture.clock,
      );
      const savedEvents: string[] = [];
      jest
        .mocked(fixture.curveRepository.save)
        .mockImplementationOnce(async (curve) => {
          savedEvents.push(...curve.getDomainEvents().map((e) => e.eventType));
          fixture.curves.set(curve.id, curve);
          return Result.ok(undefined);
        });

      const result = await useCase.execute(command({}, actorId));

      const curve = fixture.curves.get(result.value.curveId);
      expect(curve?.ownerId).toBe(actorId);
      expect(curve?.index).toBe(EEconomicIndex.SELIC);
      expect(curve?.intervals).toHaveLength(2);
      expect(savedEvents).toEqual(['CurveCreated']);
    },
  );

  it.each([{ name: ' ' }, { intervals: [] }])(
    'saves nothing for invalid content %#',
    async (overrides) => {
      const fixture = curveFixture(jest.fn);
      const useCase = new CreateCurveUseCase(
        fixture.curveRepository,
        fixture.clock,
      );

      const result = await useCase.execute(command(overrides));

      expect(result.error.code).toBe(EAppErrorCode.INVALID_CURVE);
      expect(fixture.curveRepository.save).not.toHaveBeenCalled();
    },
  );
});
