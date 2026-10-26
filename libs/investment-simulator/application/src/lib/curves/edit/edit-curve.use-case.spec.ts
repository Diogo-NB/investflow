import { CurveDetailsChanged } from '@investflow/investment-simulator-domain';
import { EAppErrorCode, Result } from '@investflow/shared-domain';
import { curveFixture, OTHER_USER, USER } from '../shared/curve-fixture';
import { EditCurveCommand } from './edit-curve.command';
import { EditCurveUseCase } from './edit-curve.use-case';

function setup() {
  const fixture = curveFixture(jest.fn);
  const useCase = new EditCurveUseCase(fixture.curveRepository, fixture.clock);
  return { ...fixture, useCase };
}

describe('EditCurveUseCase', () => {
  it('converts only the supplied fields', () => {
    const command = EditCurveCommand.fromRequest(
      USER,
      { curveId: 'curve-id' },
      {
        revision: 3,
        intervals: [
          { startDate: '2026-10-01', endDate: '2026-10-31', value: '0.1' },
        ],
      },
    );
    expect(command.revision).toBe(3);
    expect(command.name).toBeUndefined();
    expect(command.description).toBeUndefined();
    expect(command.intervals?.[0].value.value.toString()).toBe('0.1');
  });

  it('edits an own curve at its current revision and saves its change events', async () => {
    const { useCase, given, curveRepository } = setup();
    const curve = given(USER);
    let events: unknown[] = [];
    jest.mocked(curveRepository.save).mockImplementationOnce(async (saved) => {
      events = saved.getDomainEvents();
      return Result.ok(undefined);
    });

    const result = await useCase.execute(
      EditCurveCommand.fromRequest(
        USER,
        { curveId: curve.id },
        { revision: 1, name: 'CDI otimista', description: null },
      ),
    );

    expect(result.isOk()).toBe(true);
    expect(curve.revision).toBe(2);
    expect(curve.name).toBe('CDI otimista');
    expect(curve.intervals).toHaveLength(1);
    expect(events).toEqual([expect.any(CurveDetailsChanged)]);
  });

  it.each([
    [
      "another user's curve",
      USER as string | null,
      OTHER_USER,
      1,
      EAppErrorCode.CURVE_NOT_FOUND,
    ],
    ['a system curve', null, USER, 1, EAppErrorCode.CURVE_READ_ONLY],
    ['a stale revision', USER, USER, 2, EAppErrorCode.CURVE_REVISION_CONFLICT],
  ])('rejects %s', async (_, owner, actor, revision, code) => {
    const { useCase, given, curveRepository } = setup();
    const curve = given(owner);

    const result = await useCase.execute(
      EditCurveCommand.fromRequest(
        actor,
        { curveId: curve.id },
        { revision, name: 'CDI otimista' },
      ),
    );

    expect(result.error.code).toBe(code);
    expect(curve.name).toBe('CDI');
    expect(curveRepository.save).not.toHaveBeenCalled();
  });

  it('saves nothing for invalid content', async () => {
    const { useCase, given, curveRepository } = setup();
    const curve = given(USER);

    const result = await useCase.execute(
      EditCurveCommand.fromRequest(
        USER,
        { curveId: curve.id },
        { revision: 1, intervals: [] },
      ),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVALID_CURVE);
    expect(curveRepository.save).not.toHaveBeenCalled();
  });
});
