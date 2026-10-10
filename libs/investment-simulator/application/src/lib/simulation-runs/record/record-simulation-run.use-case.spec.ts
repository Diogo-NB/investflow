import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  InvestmentCalculator,
  SimulationRun,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { ApplicationNotFoundError } from '../../applications/application-not-found.error';
import { ApplicationRepository } from '../../applications/application.repository';
import {
  catalogOffer,
  cdiCurve,
  ownedApplication,
  OWNER_ID,
} from '../../applications/shared/application-fixture';
import { IndexCurveNotFoundError } from '../../index-curves/index-curve-not-found.error';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationRunRepository } from '../simulation-run.repository';
import { RecordSimulationRunCommand } from './record-simulation-run.command';
import { RecordSimulationRunUseCase } from './record-simulation-run.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup(owned = ownedApplication()) {
  const applications = {
    findById: jest.fn().mockResolvedValue(Result.ok(owned.application)),
    save: jest.fn(),
  } as unknown as jest.Mocked<ApplicationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(owned.snapshot)),
    save: jest.fn(),
  } as unknown as jest.Mocked<OfferRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<IndexCurveRepository>;
  const runs = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRunRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new RecordSimulationRunUseCase(
    applications,
    offers,
    curves,
    runs,
    new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    clock,
  );
  return { ...owned, curves, runs, useCase };
}

function command(ownerId = OWNER_ID) {
  return RecordSimulationRunCommand.fromRequest(ownerId, {
    applicationId: 'application-id',
  });
}

describe('RecordSimulationRunUseCase', () => {
  it('records the calculation of the current application', async () => {
    const { application, runs, useCase } = setup();

    const result = await useCase.execute(command());

    const run = runs.save.mock.calls[0][0] as SimulationRun;
    expect(result.value).toEqual({ id: run.id });
    expect(run.applicationId).toBe(application.id);
    expect(run.calculatedAt).toBe(NOW);
    expect(run.maturitySummary.grossBalance.isPositive()).toBe(true);
    expect(run.dailyBalances.at(-1)?.date.toIsoString()).toBe('2030-01-02');
  });

  it('loads the linked curve for indexed applications', async () => {
    const curve = cdiCurve();
    const { application } = ownedApplication();
    const snapshot = catalogOffer('CDI_PERCENTAGE').createSnapshot().value;
    application.revise({
      offerSnapshot: snapshot,
      indexCurve: curve,
      principal: application.principal,
      investmentDate: CalendarDate.of('2026-01-02'),
    });
    const { curves, runs, useCase } = setup({ application, snapshot });
    curves.findById.mockResolvedValue(Result.ok(curve));

    await useCase.execute(command());

    expect(curves.findById).toHaveBeenCalledWith(curve.id);
    expect(runs.save.mock.calls[0][0].indexCurveId).toBe(curve.id);
  });

  it('records nothing when the linked curve is no longer available', async () => {
    const curve = cdiCurve();
    const { application } = ownedApplication();
    const snapshot = catalogOffer('CDI_PERCENTAGE').createSnapshot().value;
    application.revise({
      offerSnapshot: snapshot,
      indexCurve: curve,
      principal: application.principal,
      investmentDate: CalendarDate.of('2026-01-02'),
    });
    const { curves, runs, useCase } = setup({ application, snapshot });
    curves.findById.mockResolvedValue(
      Result.err(new IndexCurveNotFoundError(curve.id)),
    );

    const result = await useCase.execute(command());

    expect(result.error).toBeInstanceOf(IndexCurveNotFoundError);
    expect(runs.save).not.toHaveBeenCalled();
  });

  it('returns calculation failures without recording them', async () => {
    const { application, snapshot } = ownedApplication();
    application.revise({
      offerSnapshot: snapshot,
      indexCurve: null,
      principal: application.principal,
      investmentDate: CalendarDate.of('2026-01-03'),
    });
    const { runs, useCase } = setup({ application, snapshot });

    const result = await useCase.execute(command());

    expect(result.error.code).toBe('INVESTMENT_DATE_NOT_BUSINESS_DAY');
    expect(runs.save).not.toHaveBeenCalled();
  });

  it("reports another owner's application as not found", async () => {
    const { runs, useCase } = setup();

    const result = await useCase.execute(command('someone-else'));

    expect(result.error).toBeInstanceOf(ApplicationNotFoundError);
    expect(runs.save).not.toHaveBeenCalled();
  });
});
