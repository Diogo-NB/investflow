import {
  OfferSnapshotOverrides,
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, Rate } from '@investflow/shared-domain';
import { ApplicationInvestmentCommandInput } from './application-command-input.type';

export interface ApplicationInvestment {
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly indexCurveId: string | null;
  readonly overrides: OfferSnapshotOverrides;
}

export function applicationInvestmentFrom(
  request: ApplicationInvestmentCommandInput,
): ApplicationInvestment {
  return {
    principal: Money.of(request.principal),
    investmentDate: CalendarDate.of(request.investmentDate),
    indexCurveId: request.indexCurveId ?? null,
    overrides: {
      ...(request.maturityDate === undefined
        ? {}
        : { maturityDate: CalendarDate.of(request.maturityDate) }),
      ...(request.redemptionTerms === undefined
        ? {}
        : {
            redemptionTerms: RedemptionTerms.create(
              request.redemptionTerms.kind,
            ),
          }),
      ...(request.remunerationTerms === undefined
        ? {}
        : {
            remunerationTerms: RemunerationTerms.create(
              request.remunerationTerms.kind,
              Rate.of(request.remunerationTerms.rate),
            ),
          }),
    },
  };
}
