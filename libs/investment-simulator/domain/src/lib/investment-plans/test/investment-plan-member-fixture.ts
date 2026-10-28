import { CalendarDate, Money } from '@investflow/shared-domain';
import { RedemptionTerms } from '../../offers/terms/redemption/redemption-terms.vo';
import { ETitleType } from '../../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { SimulationResult } from '../../simulations/simulation-result.vo';
import { InvestmentPlanMember } from '../investment-plan-member.vo';

export interface MemberOptions {
  readonly calculationStatus?: ESimulationCalculationStatus;
  // 'stale' records the result from an earlier simulation revision.
  readonly result?: 'current' | 'stale' | 'none';
  readonly redemption?: 'DAILY' | 'AT_MATURITY';
  readonly principal?: string;
  readonly iof?: string;
  readonly incomeTax?: string;
  readonly netFinalBalance?: string;
  readonly investmentDate?: string;
  readonly maturityDate?: string;
}

const REVISION = 2;

export function member({
  calculationStatus = ESimulationCalculationStatus.CALCULATED,
  result = 'current',
  redemption = 'AT_MATURITY',
  principal = '1000',
  iof = '0',
  incomeTax = '20',
  netFinalBalance = '1080',
  investmentDate = '2026-01-02',
  maturityDate = '2027-01-04',
}: MemberOptions = {}): InvestmentPlanMember {
  return InvestmentPlanMember.create({
    calculationStatus,
    simulationRevision: REVISION,
    titleType: ETitleType.CDB,
    offerTermsRevision: 1,
    curveValuesRevision: null,
    redemptionTerms: RedemptionTerms.create(redemption),
    lastResult:
      result === 'none'
        ? null
        : {
            inputs: SimulationResult.targetFor(
              result === 'current' ? REVISION : REVISION - 1,
              ETitleType.CDB,
              1,
              null,
            ),
            principal: Money.of(principal),
            iof: Money.of(iof),
            incomeTax: Money.of(incomeTax),
            netFinalBalance: Money.of(netFinalBalance),
            investmentDate: CalendarDate.of(investmentDate),
            maturityDate: CalendarDate.of(maturityDate),
          },
  });
}
