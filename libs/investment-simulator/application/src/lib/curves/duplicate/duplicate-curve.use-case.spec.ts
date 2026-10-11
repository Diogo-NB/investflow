import { EAppErrorCode } from '@investflow/shared-domain';
import { curveFixture, OTHER_USER, USER } from '../shared/curve-fixture';
import { DuplicateCurveCommand } from './duplicate-curve.command';
import { DuplicateCurveUseCase } from './duplicate-curve.use-case';

function setup() {
  const fixture = curveFixture(jest.fn);
  const useCase = new DuplicateCurveUseCase(
    fixture.curveRepository,
    fixture.clock,
  );
  return { ...fixture, useCase };
}

describe('DuplicateCurveUseCase', () => {
  it.each([null, USER])(
    "copies a curve owned by %s into the user's private copy",
    async (owner) => {
      const { useCase, given, curves } = setup();
      const source = given(owner);

      const result = await useCase.execute(
        DuplicateCurveCommand.fromRequest(USER, { curveId: source.id }),
      );

      const copy = curves.get(result.value.curveId);
      expect(copy?.id).not.toBe(source.id);
      expect(copy?.ownerId).toBe(USER);
      expect(copy?.name).toBe('CDI (cópia)');
      expect(copy?.intervals).toEqual(source.intervals);
    },
  );

  it("treats another user's curve as missing", async () => {
    const { useCase, given, curveRepository } = setup();
    const source = given(OTHER_USER);

    const result = await useCase.execute(
      DuplicateCurveCommand.fromRequest(USER, { curveId: source.id }),
    );

    expect(result.error.code).toBe(EAppErrorCode.CURVE_NOT_FOUND);
    expect(curveRepository.save).not.toHaveBeenCalled();
  });
});
