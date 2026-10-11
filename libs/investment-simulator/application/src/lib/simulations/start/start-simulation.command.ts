import {
  ETitleType,
  InvestmentInputs,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, Rate } from '@investflow/shared-domain';
import { StartSimulationCommandInput } from '../shared/simulation-command-input.type';

export class StartSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly sourceOfferId: string | null,
    readonly terms: InvestmentTerms,
    readonly investment: InvestmentInputs,
  ) {}

  static fromRequest(
    ownerId: string,
    request: StartSimulationCommandInput,
  ): StartSimulationCommand {
    const { terms, investment } = request;
    return new StartSimulationCommand(
      ownerId,
      request.offerId ?? null,
      InvestmentTerms.create({
        // CDB is the only calculable title.
        titleType: ETitleType.CDB,
        issuerId: terms.issuerId ?? null,
        maturityDate: CalendarDate.of(terms.maturityDate),
        redemption: RedemptionTerms.create(terms.redemptionTerms.kind),
        remuneration: RemunerationTerms.create(
          terms.remunerationTerms.kind,
          Rate.of(terms.remunerationTerms.rate),
        ),
      }),
      InvestmentInputs.create({
        principal: Money.of(investment.principal),
        investmentDate: CalendarDate.of(investment.investmentDate),
        indexCurveId: investment.indexCurveId ?? null,
      }),
    );
  }
}
