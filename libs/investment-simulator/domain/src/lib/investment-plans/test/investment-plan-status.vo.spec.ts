import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import {
  InvestmentPlanMemberState,
  InvestmentPlanStatus,
} from '../investment-plan-status.vo';

const { PENDING, CALCULATED, INVALID, FAILED } = ESimulationCalculationStatus;

const member = (
  calculationStatus: ESimulationCalculationStatus,
  isResultCurrent = true,
): InvestmentPlanMemberState => ({ calculationStatus, isResultCurrent });

const counts = (status: InvestmentPlanStatus) => ({
  calculating: status.calculatingCount,
  pendingIssues: status.pendingIssueCount,
  outdated: status.outdatedResultCount,
  settled: status.isSettled,
});

describe('InvestmentPlanStatus', () => {
  it('is settled for an empty plan', () => {
    expect(counts(InvestmentPlanStatus.of([]))).toEqual({
      calculating: 0,
      pendingIssues: 0,
      outdated: 0,
      settled: true,
    });
  });

  it('is settled when every result is current', () => {
    expect(
      InvestmentPlanStatus.of([member(CALCULATED), member(CALCULATED)])
        .isSettled,
    ).toBe(true);
  });

  it.each([
    ['a calculation in progress', member(PENDING), [1, 0, 0]],
    ['a recalculation over a stale result', member(PENDING, false), [1, 0, 0]],
    [
      'an invalid member keeping a stale result',
      member(INVALID, false),
      [0, 1, 0],
    ],
    ['a failed calculation', member(FAILED, false), [0, 1, 0]],
    [
      'a stale result with nothing queued',
      member(CALCULATED, false),
      [0, 0, 1],
    ],
  ])('counts %s once', (_, state, [calculating, pendingIssues, outdated]) => {
    expect(counts(InvestmentPlanStatus.of([state]))).toEqual({
      calculating,
      pendingIssues,
      outdated,
      settled: false,
    });
  });

  it('counts each member under one state', () => {
    const status = InvestmentPlanStatus.of([
      member(PENDING, false),
      member(PENDING, true),
      member(INVALID, true),
      member(FAILED, false),
      member(CALCULATED, false),
      member(CALCULATED, true),
    ]);

    expect(counts(status)).toEqual({
      calculating: 2,
      pendingIssues: 2,
      outdated: 1,
      settled: false,
    });
  });

  it('compares by its counts', () => {
    const one = InvestmentPlanStatus.of([member(PENDING), member(CALCULATED)]);
    const same = InvestmentPlanStatus.of([member(PENDING)]);
    const other = InvestmentPlanStatus.of([member(FAILED)]);

    expect(one.equals(same)).toBe(true);
    expect(one.equals(other)).toBe(false);
  });
});
