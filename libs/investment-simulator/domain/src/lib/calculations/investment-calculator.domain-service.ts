import {
  BusinessDayCalendar,
  CalendarDate,
  Money,
  Result,
} from '@investflow/shared-domain';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { Offer } from '../offers/offer.aggregate';
import { TitleType } from '../offers/title-type.enum';
import { Application } from '../applications/application.aggregate';
import { BusinessDayAccrualSchedule } from './business-day-accrual-schedule.domain-service';
import { CdbTaxCalculator } from './cdb-tax-calculator.domain-service';
import { InvestmentCalculationError } from './investment-calculation.error';
import {
  DailyInvestmentBalance,
  InvestmentCalculation,
} from './investment-calculation.type';
import {
  DailyAccrual,
  PreparedDailyAccrual,
  RemunerationStrategy,
} from './remuneration-strategy.contract';

export interface CalculateInvestmentInput {
  readonly application: Application;
  readonly offerSnapshot: Offer;
  readonly indexCurve?: IndexCurve;
}

export class InvestmentCalculator {
  private readonly strategies: readonly RemunerationStrategy[];
  private readonly accrualSchedule: BusinessDayAccrualSchedule;
  private readonly taxes = new CdbTaxCalculator();

  constructor(
    calendar: BusinessDayCalendar,
    strategies: readonly RemunerationStrategy[],
  ) {
    this.strategies = [...strategies];
    this.accrualSchedule = new BusinessDayAccrualSchedule(calendar);
  }

  calculate(
    input: CalculateInvestmentInput,
  ): Result<InvestmentCalculation, InvestmentCalculationError> {
    const validation = this.validateInput(input);
    if (validation.isErr()) return Result.err(validation.error);

    const { application, offerSnapshot } = input;
    if (offerSnapshot.titleType !== TitleType.CDB) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_TITLE_UNSUPPORTED',
          'only CDB titles are supported',
          { titleType: offerSnapshot.titleType },
        ),
      );
    }
    const strategy = this.strategies.find(
      (candidate) => candidate.kind === offerSnapshot.remunerationTerms.kind,
    );
    if (!strategy) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_REMUNERATION_UNSUPPORTED',
          'no strategy supports the remuneration',
          { remunerationKind: offerSnapshot.remunerationTerms.kind },
        ),
      );
    }
    return this.accrualSchedule
      .create(application.investmentDate, offerSnapshot.maturityDate)
      .andThen((businessDates) =>
        strategy.prepare({
          terms: offerSnapshot.remunerationTerms,
          accruals: this.createDailyAccruals(businessDates),
          indexCurve: input.indexCurve,
        }),
      )
      .andThen((preparedAccruals) =>
        Result.fromThrowable(
          () => {
            const dailyBalances = this.accumulate(
              application.principal,
              preparedAccruals,
            );
            const grossBalance =
              dailyBalances[dailyBalances.length - 1].grossBalance;
            const grossEarnings = grossBalance.subtract(application.principal);
            return { dailyBalances, grossBalance, grossEarnings };
          },
          (cause) => this.calculationFailed(cause),
        ),
      )
      .andThen(({ dailyBalances, grossBalance, grossEarnings }) =>
        this.taxes
          .calculate({
            grossEarnings,
            investmentDate: application.investmentDate,
            maturityDate: offerSnapshot.maturityDate,
          })
          .andThen((taxes) =>
            Result.fromThrowable(
              () => ({
                dailyBalances,
                maturitySummary: {
                  principal: application.principal,
                  grossBalance,
                  grossEarnings,
                  ...taxes,
                  netBalance: grossBalance.subtract(taxes.totalTaxes),
                },
              }),
              (cause) => this.calculationFailed(cause),
            ),
          ),
      );
  }

  private validateInput(
    input: CalculateInvestmentInput,
  ): Result<void, InvestmentCalculationError> {
    const { application, offerSnapshot } = input;
    if (application.deletedAt) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_APPLICATION_UNAVAILABLE',
          'the application is deleted',
          { applicationId: application.id },
        ),
      );
    }
    if (
      !offerSnapshot.isSnapshot ||
      offerSnapshot.id !== application.offerSnapshotId
    ) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_OFFER_SNAPSHOT_MISMATCH',
          'the offer must be the application snapshot',
          {
            expectedOfferId: application.offerSnapshotId,
            actualOfferId: offerSnapshot.id,
          },
        ),
      );
    }
    if (offerSnapshot.deletedAt) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_OFFER_UNAVAILABLE',
          'the offer snapshot is deleted',
          { offerId: offerSnapshot.id },
        ),
      );
    }
    return Result.ok(undefined);
  }

  private createDailyAccruals(
    businessDates: readonly CalendarDate[],
  ): DailyAccrual[] {
    return businessDates.slice(1).map((balanceDate, index) => ({
      rateReferenceDate: businessDates[index],
      balanceDate,
    }));
  }

  private accumulate(
    principal: Money,
    preparedAccruals: readonly PreparedDailyAccrual[],
  ): DailyInvestmentBalance[] {
    let previousBalance = principal;
    return preparedAccruals.map(({ balanceDate, factor }) => {
      const grossBalance = previousBalance.times(factor);
      const dailyGrossEarnings = grossBalance.subtract(previousBalance);
      previousBalance = grossBalance;

      return {
        date: balanceDate,
        grossBalance,
        dailyGrossEarnings,
        accumulatedGrossEarnings: grossBalance.subtract(principal),
      };
    });
  }

  private calculationFailed(cause: unknown): InvestmentCalculationError {
    return new InvestmentCalculationError(
      'INVESTMENT_CALCULATION_FAILED',
      'accrual could not be calculated',
      undefined,
      cause,
    );
  }
}
