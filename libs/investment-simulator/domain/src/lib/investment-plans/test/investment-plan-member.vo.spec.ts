import { RedemptionTerms } from '../../offers/terms/redemption/redemption-terms.vo';
import { ETitleType } from '../../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { InvestmentPlanMember } from '../investment-plan-member.vo';
import { member } from './investment-plan-member-fixture';

describe('InvestmentPlanMember', () => {
  it('has a current result when it was calculated from the present premises', () => {
    expect(member().isResultCurrent).toBe(true);
  });

  it('has a stale result after the simulation changed', () => {
    expect(member({ result: 'stale' }).isResultCurrent).toBe(false);
  });

  it('has no current result without a result', () => {
    expect(member({ result: 'none' }).isResultCurrent).toBe(false);
  });

  it.each([
    ['the offer terms', { offerTermsRevision: 2 }],
    ['the curve values', { curveValuesRevision: 1 }],
    ['the methodology of the title type', { titleType: ETitleType.LCI }],
  ])('has a stale result after %s changed', (_, change) => {
    const current = member();
    const lastResult = current.lastResult;
    if (!lastResult) throw new Error('Expected a result');

    const changed = InvestmentPlanMember.create({
      calculationStatus: ESimulationCalculationStatus.CALCULATED,
      simulationRevision: lastResult.inputs.simulationRevision,
      titleType: ETitleType.CDB,
      offerTermsRevision: 1,
      curveValuesRevision: null,
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      lastResult,
      ...change,
    });

    expect(changed.isResultCurrent).toBe(false);
  });

  it('compares by value', () => {
    expect(member().equals(member())).toBe(true);
    expect(member().equals(member({ principal: '1000.01' }))).toBe(false);
    expect(member().equals(member({ result: 'none' }))).toBe(false);
    expect(member({ result: 'none' }).equals(member({ result: 'none' }))).toBe(
      true,
    );
  });
});
