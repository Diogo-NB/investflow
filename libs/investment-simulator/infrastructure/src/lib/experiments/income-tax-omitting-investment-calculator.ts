import {
  InvestmentCalculationError,
  InvestmentCalculator,
  InvestmentProjection,
  InvestmentScenario,
} from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';

// A deliberate logic error: the net outcome leaves income tax out, so
// taxable titles are overstated while exempt ones stay right. The input
// fingerprint does not change, so nothing marks the results stale.
export class IncomeTaxOmittingInvestmentCalculator extends InvestmentCalculator {
  override calculate(
    scenario: InvestmentScenario,
  ): Result<InvestmentProjection, InvestmentCalculationError> {
    return super.calculate(scenario).map((projection) => {
      const { iof, incomeTax } = projection.taxes;
      return InvestmentProjection.create({
        principal: projection.principal,
        term: projection.term,
        dailyBalances: projection.dailyBalances,
        taxes: {
          iof,
          incomeTax: {
            ...incomeTax,
            amount: incomeTax.amount.subtract(incomeTax.amount),
          },
          total: iof.amount,
        },
      });
    });
  }
}
