import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  InvestmentCalculator,
  SimulationCalculationService,
  Simulation,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  EAppErrorCode,
  Money,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationRepository } from '../simulation.repository';
import { CreateSimulationCommandInput } from '../shared/simulation-command-input.type';
import {
  catalogOffer,
  cdiCurve,
  cdiOffer,
  investmentRequest,
  OWNER_ID,
} from '../shared/simulation-fixture';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { CreateSimulationCommand } from './create-simulation.command';
import { CreateSimulationUseCase } from './create-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const offer = catalogOffer();
  const simulations = {
    findOwned: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(offer)),
  } as unknown as jest.Mocked<OfferRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<CurveRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new CreateSimulationUseCase(
    simulations,
    new SimulationPremisesService(offers, curves),
    new SimulationCalculationService(new InvestmentCalculator()),
    clock,
  );
  return { offer, simulations, offers, curves, useCase };
}

function command(overrides: Partial<CreateSimulationCommandInput> = {}) {
  return CreateSimulationCommand.fromRequest(OWNER_ID, {
    offerId: 'offer-id',
    investment: investmentRequest(),
    ...overrides,
  });
}

describe('CreateSimulationCommand', () => {
  it('converts the request into an offer id and an investment', () => {
    const created = command({
      investment: investmentRequest({ curveId: 'curve-id' }),
    });

    expect(created.offerId).toBe('offer-id');
    expect(created.investment.principal.equals(Money.of('1000'))).toBe(true);
    expect(created.investment.curveId).toBe('curve-id');
  });
});

describe('CreateSimulationUseCase', () => {
  it('saves a simulation of a visible offer waiting for its calculation', async () => {
    const { offer, simulations, offers, useCase } = setup();

    const result = await useCase.execute(command());

    const simulation = simulations.save.mock.calls[0][0] as Simulation;
    expect(offers.findById).toHaveBeenCalledWith('offer-id');
    expect(simulation.ownerId).toBe(OWNER_ID);
    expect(simulation.offerId).toBe(offer.id);
    expect(simulation.result).toBeNull();
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual({
      kind: ESimulationCalculationCauseKind.CREATED,
      actorId: OWNER_ID,
    });
    expect(simulation.calculation.changedAt).toBe(NOW);
    expect(
      simulation.getDomainEvents().map((event) => event.eventType),
    ).toEqual(['SimulationCreated']);
    expect(result.value).toEqual({ simulationId: simulation.id });
  });

  it('loads the curve of indexed remuneration', async () => {
    const { curves, offers, simulations, useCase } = setup();
    const curve = cdiCurve();
    offers.findById.mockResolvedValue(Result.ok(cdiOffer()));
    curves.findById.mockResolvedValue(Result.ok(curve));

    await useCase.execute(
      command({ investment: investmentRequest({ curveId: curve.id }) }),
    );

    expect(curves.findById).toHaveBeenCalledWith(curve.id);
    const simulation = simulations.save.mock.calls[0][0] as Simulation;
    expect(simulation.investment.curveId).toBe(curve.id);
  });

  it('saves nothing when validation rejects it', async () => {
    const { simulations, useCase } = setup();

    const result = await useCase.execute(
      command({
        investment: investmentRequest({ investmentDate: '2026-01-03' }),
      }),
    );

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
    );
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'offer',
      (deps: ReturnType<typeof setup>) =>
        deps.offers.findById.mockResolvedValue(
          Result.err(new OfferNotFoundError('offer-id')),
        ),
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
    [
      "another user's offer",
      (deps: ReturnType<typeof setup>) =>
        deps.offers.findById.mockResolvedValue(
          Result.ok(catalogOffer('another-owner')),
        ),
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
    [
      'curve',
      (deps: ReturnType<typeof setup>) =>
        deps.curves.findById.mockResolvedValue(
          Result.err(new CurveNotFoundError('curve-id')),
        ),
      EAppErrorCode.CURVE_NOT_FOUND,
    ],
    [
      "another user's curve",
      (deps: ReturnType<typeof setup>) =>
        deps.curves.findById.mockResolvedValue(
          Result.ok(cdiCurve('another-owner')),
        ),
      EAppErrorCode.CURVE_NOT_FOUND,
    ],
  ])('stops when the %s is missing', async (_, arrange, code) => {
    const deps = setup();
    deps.curves.findById.mockResolvedValue(Result.ok(cdiCurve()));
    arrange(deps);

    const result = await deps.useCase.execute(
      command({ investment: investmentRequest({ curveId: 'curve-id' }) }),
    );

    expect(result.error.code).toBe(code);
    expect(deps.simulations.save).not.toHaveBeenCalled();
  });
});
