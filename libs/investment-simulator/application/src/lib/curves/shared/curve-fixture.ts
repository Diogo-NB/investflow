// An in-memory repository shared by the curve use-case specs.
import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  CalendarDate,
  CalendarDateRange,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveNotFoundError } from '../curve-not-found.error';
import { CurveRepository } from '../curve.repository';

export const USER = 'user-1';
export const OTHER_USER = 'user-2';
export const NOW = UtcInstant.ofIso('2026-10-11T12:00:00Z');

// Specs pass jest.fn, which the library build cannot reference.
type Spy = <F extends (...args: never[]) => unknown>(implementation: F) => F;

export function curveFixture(spy: Spy) {
  const curves = new Map<string, Curve>();

  const curveRepository = {
    findById: spy(async (id: string) => {
      const curve = curves.get(id);
      return curve && !curve.deletedAt
        ? Result.ok(curve)
        : Result.err(new CurveNotFoundError(id));
    }),
    save: spy(async (curve: Curve) => {
      curves.set(curve.id, curve);
      curve.clearDomainEvents();
      return Result.ok(undefined);
    }),
  } satisfies CurveRepository;

  const clock = { now: () => NOW } as unknown as Clock;

  // Stores a curve without recording the save.
  function given(ownerId: string | null): Curve {
    const curve = Curve.create(
      {
        ownerId,
        index: EEconomicIndex.CDI,
        name: 'CDI',
        description: 'Cenário base',
        intervals: [
          CurveInterval.create(
            CalendarDateRange.of(
              CalendarDate.of('2026-10-01'),
              CalendarDate.of('2026-10-31'),
            ),
            IndexValue.of('0.12'),
          ),
        ],
      },
      NOW,
    ).value.clearDomainEvents();
    curves.set(curve.id, curve);
    return curve;
  }

  return { curves, curveRepository, clock, given };
}
