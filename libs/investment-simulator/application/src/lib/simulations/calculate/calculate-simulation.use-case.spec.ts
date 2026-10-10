import {
  InvestmentCalculator,
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
import { IssuerNotFoundError } from '../../issuers/issuer-not-found.error';
import { IssuerRepository } from '../../issuers/issuer.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import {
  catalogOffer,
  cdiCurve,
  inputsRequest,
  issuer,
  ownedSimulation,
  OWNER_ID,
} from '../shared/simulation-fixture';
import { CalculateSimulationCommand } from './calculate-simulation.command';
import { CalculateSimulationUseCase } from './calculate-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const simulation = ownedSimulation();
  const offer = catalogOffer();
  const simulations = {
    findById: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const calculations = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationCalculationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(offer)),
    save: jest.fn(),
  } as unknown as jest.Mocked<OfferRepository>;
  const issuers = {
    findById: jest.fn().mockResolvedValue(Result.ok(issuer())),
    save: jest.fn(),
  } as unknown as jest.Mocked<IssuerRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<IndexCurveRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new CalculateSimulationUseCase(
    simulations,
    calculations,
    offers,
    issuers,
    curves,
    new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    clock,
  );
  return {
    simulation,
    offer,
    simulations,
    calculations,
    offers,
    issuers,
    curves,
    useCase,
  };
}

function recorded(
  calculations: jest.Mocked<SimulationCalculationRepository>,
): SimulationCalculation {
  return calculations.save.mock.calls[0][0] as SimulationCalculation;
}

describe('CalculateSimulationCommand', () => {
  it('converts the request into CDB inputs', () => {
    const command = CalculateSimulationCommand.fromCreateRequest(OWNER_ID, {
      ...inputsRequest({
        indexCurveId: 'curve-id',
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      }),
      offerId: 'offer-id',
    });

    expect(command.target).toEqual({ sourceOfferId: 'offer-id' });
    expect(command.inputs.principal.equals(Money.of('1000'))).toBe(true);
    expect(command.inputs.investmentDate.toIsoString()).toBe('2026-01-02');
    expect(command.inputs.indexCurveId).toBe('curve-id');
    expect(command.inputs.terms.titleType).toBe('CDB');
    expect(command.inputs.terms.maturityDate.toIsoString()).toBe('2030-01-02');
    expect(command.inputs.terms.redemption.kind).toBe('AT_MATURITY');
    expect(command.inputs.terms.remuneration.kind).toBe('CDI_PERCENTAGE');
  });

  it('targets typed terms and existing simulations', () => {
    expect(
      CalculateSimulationCommand.fromCreateRequest(OWNER_ID, inputsRequest())
        .target,
    ).toEqual({ sourceOfferId: null });
    expect(
      CalculateSimulationCommand.fromRequest(
        OWNER_ID,
        { simulationId: 'simulation-id' },
        inputsRequest(),
      ).target,
    ).toEqual({ simulationId: 'simulation-id' });
  });
});

describe('CalculateSimulationUseCase', () => {
  it('creates a simulation with its first calculation', async () => {
    const { offer, simulations, calculations, useCase } = setup();

    const result = await useCase.execute(
      CalculateSimulationCommand.fromCreateRequest(OWNER_ID, {
        ...inputsRequest(),
        offerId: offer.id,
      }),
    );

    const simulation = simulations.save.mock.calls[0][0];
    const calculation = recorded(calculations);
    expect(simulation.ownerId).toBe(OWNER_ID);
    expect(simulation.sourceOfferId).toBe(offer.id);
    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.calculatedAt).toBe(NOW);
    expect(calculation.result.dailyBalances.at(-1)?.date.toIsoString()).toBe(
      '2030-01-02',
    );
    expect(result.value).toEqual({
      simulationId: simulation.id,
      calculationId: calculation.id,
    });
  });

  it("appends a calculation to the requester's simulation", async () => {
    const { simulation, simulations, calculations, useCase } = setup();

    const result = await useCase.execute(
      CalculateSimulationCommand.fromRequest(
        OWNER_ID,
        { simulationId: simulation.id },
        inputsRequest({ principal: '2000' }),
      ),
    );

    expect(simulations.findById).toHaveBeenCalledWith(simulation.id, OWNER_ID);
    expect(simulations.save).not.toHaveBeenCalled();
    expect(
      recorded(calculations).inputs.principal.equals(Money.of('2000')),
    ).toBe(true);
    expect(result.value.simulationId).toBe(simulation.id);
  });

  it('loads the curve of indexed remuneration', async () => {
    const { curves, calculations, useCase } = setup();
    const curve = cdiCurve();
    curves.findById.mockResolvedValue(Result.ok(curve));

    await useCase.execute(
      CalculateSimulationCommand.fromCreateRequest(
        OWNER_ID,
        inputsRequest({
          indexCurveId: curve.id,
          maturityDate: '2026-02-02',
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1' },
        }),
      ),
    );

    expect(curves.findById).toHaveBeenCalledWith(curve.id);
    expect(recorded(calculations).inputs.indexCurveId).toBe(curve.id);
  });

  it('saves nothing when the calculation is rejected', async () => {
    const { simulations, calculations, useCase } = setup();

    const result = await useCase.execute(
      CalculateSimulationCommand.fromCreateRequest(
        OWNER_ID,
        inputsRequest({ investmentDate: '2026-01-03' }),
      ),
    );

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
    );
    expect(simulations.save).not.toHaveBeenCalled();
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('saves nothing when the inputs do not form a scenario', async () => {
    const { simulation, calculations, useCase } = setup();

    const result = await useCase.execute(
      CalculateSimulationCommand.fromRequest(
        OWNER_ID,
        { simulationId: simulation.id },
        inputsRequest({ principal: '0' }),
      ),
    );

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('rejects a deleted simulation', async () => {
    const { simulation, calculations, useCase } = setup();
    simulation.delete(NOW);

    const result = await useCase.execute(
      CalculateSimulationCommand.fromRequest(
        OWNER_ID,
        { simulationId: simulation.id },
        inputsRequest(),
      ),
    );

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_DELETED);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'simulation',
      (deps: ReturnType<typeof setup>) =>
        deps.simulations.findById.mockResolvedValue(
          Result.err(new SimulationNotFoundError('simulation-id')),
        ),
      EAppErrorCode.SIMULATION_NOT_FOUND,
    ],
    [
      'issuer',
      (deps: ReturnType<typeof setup>) =>
        deps.issuers.findById.mockResolvedValue(
          Result.err(new IssuerNotFoundError('issuer-id')),
        ),
      EAppErrorCode.ISSUER_NOT_FOUND,
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
      CalculateSimulationCommand.fromRequest(
        OWNER_ID,
        { simulationId: deps.simulation.id },
        inputsRequest({
          indexCurveId: 'curve-id',
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1' },
        }),
      ),
    );

    expect(result.error.code).toBe(code);
    expect(deps.calculations.save).not.toHaveBeenCalled();
  });

  it('rejects a missing or deleted source offer', async () => {
    const { offers, simulations, useCase } = setup();
    offers.findById.mockResolvedValue(
      Result.err(new OfferNotFoundError('offer-id')),
    );

    const result = await useCase.execute(
      CalculateSimulationCommand.fromCreateRequest(OWNER_ID, {
        ...inputsRequest(),
        offerId: 'offer-id',
      }),
    );

    expect(result.error.code).toBe(EAppErrorCode.OFFER_NOT_FOUND);
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('does not look up an offer for typed terms', async () => {
    const { offers, useCase } = setup();

    await useCase.execute(
      CalculateSimulationCommand.fromCreateRequest(OWNER_ID, inputsRequest()),
    );

    expect(offers.findById).not.toHaveBeenCalled();
  });
});
