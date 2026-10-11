import {
  ETitleType,
  InvestmentCalculator,
  Simulation,
  SimulationCalculation,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  BrazilianBusinessDayCalendar,
  EAppErrorCode,
  Money,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { IndexCurveNotFoundError } from '../../index-curves/index-curve-not-found.error';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationRepository } from '../simulation.repository';
import {
  catalogOffer,
  cdiCurve,
  investmentRequest,
  OWNER_ID,
  termsRequest,
} from '../shared/simulation-fixture';
import { StartSimulationCommand } from './start-simulation.command';
import { StartSimulationUseCase } from './start-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const simulations = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const calculations = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationCalculationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(catalogOffer())),
    save: jest.fn(),
  } as unknown as jest.Mocked<OfferRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<IndexCurveRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new StartSimulationUseCase(
    simulations,
    calculations,
    offers,
    curves,
    new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    clock,
  );
  return { simulations, calculations, offers, curves, useCase };
}

function command(
  overrides: Partial<
    Parameters<typeof StartSimulationCommand.fromRequest>[1]
  > = {},
) {
  return StartSimulationCommand.fromRequest(OWNER_ID, {
    terms: termsRequest(),
    investment: investmentRequest(),
    ...overrides,
  });
}

describe('StartSimulationCommand', () => {
  it('converts the request into terms and an investment', () => {
    const started = StartSimulationCommand.fromRequest(OWNER_ID, {
      offerId: 'offer-id',
      terms: termsRequest({
        titleType: ETitleType.LCI,
        issuerName: undefined,
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      }),
      investment: investmentRequest({ indexCurveId: 'curve-id' }),
    });

    expect(started.sourceOfferId).toBe('offer-id');
    expect(started.terms.titleType).toBe(ETitleType.LCI);
    expect(started.terms.issuerName).toBeNull();
    expect(started.terms.maturityDate.toIsoString()).toBe('2030-01-02');
    expect(started.terms.remuneration.kind).toBe('CDI_PERCENTAGE');
    expect(started.investment.principal.equals(Money.of('1000'))).toBe(true);
    expect(started.investment.indexCurveId).toBe('curve-id');
  });
});

describe('StartSimulationUseCase', () => {
  it('saves the simulation with its first calculation', async () => {
    const { simulations, calculations, useCase } = setup();

    const result = await useCase.execute(command({ offerId: 'offer-id' }));

    const simulation = simulations.save.mock.calls[0][0] as Simulation;
    const calculation = calculations.save.mock
      .calls[0][0] as SimulationCalculation;
    expect(simulation.ownerId).toBe(OWNER_ID);
    expect(simulation.sourceOfferId).toBe('offer-id');
    expect(simulation.terms.issuerName).toBe('Banco Local');
    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.calculatedAt).toBe(NOW);
    expect(result.value).toEqual({
      simulationId: simulation.id,
      calculationId: calculation.id,
    });
  });

  it('starts without an issuer or a source offer', async () => {
    const { offers, simulations, useCase } = setup();

    const result = await useCase.execute(
      command({ terms: termsRequest({ issuerName: null }) }),
    );

    expect(result.isOk()).toBe(true);
    expect(offers.findById).not.toHaveBeenCalled();
    expect(
      (simulations.save.mock.calls[0][0] as Simulation).terms.issuerName,
    ).toBeNull();
  });

  it('loads the curve of indexed remuneration', async () => {
    const { curves, calculations, useCase } = setup();
    const curve = cdiCurve();
    curves.findById.mockResolvedValue(Result.ok(curve));

    await useCase.execute(
      command({
        terms: termsRequest({
          maturityDate: '2026-02-02',
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1' },
        }),
        investment: investmentRequest({ indexCurveId: curve.id }),
      }),
    );

    expect(curves.findById).toHaveBeenCalledWith(curve.id);
    expect(
      (calculations.save.mock.calls[0][0] as SimulationCalculation).investment
        .indexCurveId,
    ).toBe(curve.id);
  });

  it('saves nothing when the first calculation is rejected', async () => {
    const { simulations, calculations, useCase } = setup();

    const result = await useCase.execute(
      command({
        investment: investmentRequest({ investmentDate: '2026-01-03' }),
      }),
    );

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
    );
    expect(simulations.save).not.toHaveBeenCalled();
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('saves nothing when an LCA term is shorter than its minimum', async () => {
    const { simulations, useCase } = setup();

    const result = await useCase.execute(
      command({
        terms: termsRequest({
          titleType: ETitleType.LCA,
          maturityDate: '2026-06-01',
        }),
      }),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_TERM_TOO_SHORT);
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'source offer',
      (deps: ReturnType<typeof setup>) =>
        deps.offers.findById.mockResolvedValue(
          Result.err(new OfferNotFoundError('offer-id')),
        ),
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
    [
      'curve',
      (deps: ReturnType<typeof setup>) =>
        deps.curves.findById.mockResolvedValue(
          Result.err(new IndexCurveNotFoundError('curve-id')),
        ),
      EAppErrorCode.INDEX_CURVE_NOT_FOUND,
    ],
  ])('stops when the %s is missing', async (_, arrange, code) => {
    const deps = setup();
    arrange(deps);

    const result = await deps.useCase.execute(
      command({
        offerId: 'offer-id',
        terms: termsRequest({
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1' },
        }),
        investment: investmentRequest({ indexCurveId: 'curve-id' }),
      }),
    );

    expect(result.error.code).toBe(code);
    expect(deps.simulations.save).not.toHaveBeenCalled();
  });
});
