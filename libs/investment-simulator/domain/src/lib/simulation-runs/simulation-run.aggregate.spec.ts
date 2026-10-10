import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Application } from '../applications/application.aggregate';
import { InvestmentCalculator } from '../calculations/investment-calculator.domain-service';
import { Offer } from '../offers/offer.aggregate';
import { RedemptionTerms } from '../offers/terms/redemption/redemption-terms.vo';
import { RemunerationTerms } from '../offers/terms/remuneration/remuneration-terms.vo';
import { TitleType } from '../offers/title-type.enum';
import { SimulationRun } from './simulation-run.aggregate';

const CALCULATED_AT = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function calculatedApplication() {
  const offerSnapshot = Offer.create({
    titleType: TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: CalendarDate.of('2026-01-06'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
  }).createSnapshot().value;
  const application = Application.create({
    ownerId: 'owner-id',
    offerSnapshot,
    indexCurve: null,
    principal: Money.of('1000'),
    investmentDate: CalendarDate.of('2026-01-02'),
  }).value;
  const scenario = application.toScenario(offerSnapshot, null).value;
  const calculation = new InvestmentCalculator(
    new BrazilianBusinessDayCalendar(),
  ).calculate(scenario).value;
  return { application, calculation, offerSnapshot };
}

describe('SimulationRun', () => {
  it('freezes the application inputs and the calculated results', () => {
    const { application, calculation } = calculatedApplication();

    const run = SimulationRun.record({
      application,
      calculation,
      calculatedAt: CALCULATED_AT,
    });

    expect(run.id).not.toBe(application.id);
    expect(run.ownerId).toBe(application.ownerId);
    expect(run.applicationId).toBe(application.id);
    expect(run.offerSnapshotId).toBe(application.offerSnapshotId);
    expect(run.indexCurveId).toBeNull();
    expect(run.principal).toBe(application.principal);
    expect(run.investmentDate).toBe(application.investmentDate);
    expect(run.methodologyVersion).toBe(calculation.methodologyVersion);
    expect(run.calculatedAt).toBe(CALCULATED_AT);
    expect(run.maturitySummary).toBe(calculation.maturitySummary);
    expect(run.dailyBalances).toEqual(calculation.dailyBalances);
    expect(run.getDomainEvents()).toEqual([]);
  });

  it('keeps its record when the application is revised later', () => {
    const { application, calculation, offerSnapshot } = calculatedApplication();
    const run = SimulationRun.record({
      application,
      calculation,
      calculatedAt: CALCULATED_AT,
    });

    application.revise({
      offerSnapshot,
      indexCurve: null,
      principal: Money.of('5000'),
      investmentDate: CalendarDate.of('2026-01-05'),
    });

    expect(run.principal.amount.toString()).toBe('1000');
    expect(run.investmentDate.toIsoString()).toBe('2026-01-02');
  });

  it('reconstitutes the stored record and its identity', () => {
    const { application, calculation } = calculatedApplication();
    const run = SimulationRun.record({
      application,
      calculation,
      calculatedAt: CALCULATED_AT,
    });

    const restored = SimulationRun.reconstitute({
      id: run.id,
      ownerId: run.ownerId,
      applicationId: run.applicationId,
      offerSnapshotId: run.offerSnapshotId,
      indexCurveId: run.indexCurveId,
      principal: run.principal,
      investmentDate: run.investmentDate,
      methodologyVersion: run.methodologyVersion,
      calculatedAt: run.calculatedAt,
      maturitySummary: run.maturitySummary,
      dailyBalances: run.dailyBalances,
    });

    expect(restored.id).toBe(run.id);
    expect(restored.dailyBalances).toEqual(run.dailyBalances);
  });
});
