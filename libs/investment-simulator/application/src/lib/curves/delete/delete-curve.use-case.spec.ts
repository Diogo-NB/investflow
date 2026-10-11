import { EAppErrorCode } from '@investflow/shared-domain';
import { curveFixture, OTHER_USER, USER } from '../shared/curve-fixture';
import { DeleteCurveCommand } from './delete-curve.command';
import { DeleteCurveUseCase } from './delete-curve.use-case';

function setup() {
  const fixture = curveFixture(jest.fn);
  const useCase = new DeleteCurveUseCase(
    fixture.curveRepository,
    fixture.clock,
  );
  return { ...fixture, useCase };
}

describe('DeleteCurveUseCase', () => {
  it.each([USER, null])('deletes a curve owned by %s', async (owner) => {
    const { useCase, given } = setup();
    const curve = given(owner);

    const result = await useCase.execute(
      DeleteCurveCommand.fromRequest(owner, { curveId: curve.id }),
    );

    expect(result.isOk()).toBe(true);
    expect(curve.deletedAt).not.toBeNull();
    expect(curve.revision).toBe(2);
  });

  it.each([
    ['a system curve by a user', null, USER, EAppErrorCode.CURVE_READ_ONLY],
    [
      "another user's curve",
      USER as string | null,
      OTHER_USER,
      EAppErrorCode.CURVE_NOT_FOUND,
    ],
  ])('refuses %s', async (_, owner, actor, code) => {
    const { useCase, given, curveRepository } = setup();
    const curve = given(owner);

    const result = await useCase.execute(
      DeleteCurveCommand.fromRequest(actor, { curveId: curve.id }),
    );

    expect(result.error.code).toBe(code);
    expect(curve.deletedAt).toBeNull();
    expect(curveRepository.save).not.toHaveBeenCalled();
  });
});
