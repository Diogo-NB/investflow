import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  InvestmentCalculator,
  SimulationCalculationService,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import {
  catalogOffer,
  cdiCurve,
  ownedSimulation,
  uncoveredCdiOffer,
} from '../shared/simulation-fixture';
import { CalculateSimulationCommand } from './calculate-simulation.command';
import { CalculateSimulationUseCase } from './calculate-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');
const FAILURE = new AppError('Falhou.', {
  code: EAppErrorCode.REPOSITORY_SAVE_FAILED,
  kind: 'unexpected',
});

function setup(curveId: string | null = null) {
  const offer = catalogOffer();
  const simulation = ownedSimulation(offer.id, curveId);
  const simulations = {
    findById: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(offer)),
  } as unknown as jest.Mocked<OfferRepository>;
  const curves = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<CurveRepository>;
  const useCase = new CalculateSimulationUseCase(
    simulations,
    offers,
    curves,
    new SimulationCalculationService(new InvestmentCalculator()),
    { now: () => NOW } as unknown as Clock,
  );
  const execute = () =>
    useCase.execute(CalculateSimulationCommand.of(simulation.id));
  return { offer, simulation, simulations, offers, curves, execute };
}

describe('CalculateSimulationUseCase', () => {
  it('records the result and keeps the cause', async () => {
    const { offer, simulation, simulations, execute } = setup();

    expect((await execute()).isOk()).toBe(true);

    expect(simulations.save).toHaveBeenCalledWith(simulation);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );
    expect(simulation.calculation.cause.kind).toBe(
      ESimulationCalculationCauseKind.CREATED,
    );
    expect(simulation.result?.inputs).toMatchObject({
      simulationRevision: 1,
      offerTermsRevision: offer.termsRevision,
    });
    expect(simulation.result?.calculatedAt).toBe(NOW);
  });

  it('records an uncovered period as invalid without retrying', async () => {
    const curve = cdiCurve();
    const { simulation, simulations, offers, curves, execute } = setup(
      curve.id,
    );
    offers.findById.mockResolvedValue(Result.ok(uncoveredCdiOffer()));
    curves.findById.mockResolvedValue(Result.ok(curve));

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.INVALID,
    );
    expect(simulation.calculation.reason?.code).toBe(
      EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
    );
    expect(simulation.calculation.inputs.curveValuesRevision).toBe(
      curve.valuesRevision,
    );
    expect(simulations.save).toHaveBeenCalledWith(simulation);
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
      'curve',
      (deps: ReturnType<typeof setup>) =>
        deps.curves.findById.mockResolvedValue(
          Result.err(new CurveNotFoundError('curve-id')),
        ),
      EAppErrorCode.CURVE_NOT_FOUND,
    ],
  ])('records a deleted %s as invalid', async (_, arrange, code) => {
    const deps = setup('curve-id');
    arrange(deps);

    expect((await deps.execute()).isOk()).toBe(true);

    expect(deps.simulation.calculation.status).toBe(
      ESimulationCalculationStatus.INVALID,
    );
    expect(deps.simulation.calculation.reason?.code).toBe(code);
    expect(deps.simulation.calculation.inputs).toEqual({
      simulationRevision: 1,
      offerTermsRevision: null,
      curveValuesRevision: null,
    });
  });

  it.each([
    ['a replayed message', () => undefined],
    [
      'a renamed offer',
      (deps: ReturnType<typeof setup>) =>
        deps.offer.markPersisted().edit({ name: 'Renomeada' }, NOW),
    ],
  ])(
    'skips a calculation already recorded for the current inputs after %s',
    async (_, arrange) => {
      const deps = setup();
      expect((await deps.execute()).isOk()).toBe(true);
      const recorded = deps.simulation.result;
      arrange(deps);

      expect((await deps.execute()).isOk()).toBe(true);

      expect(deps.simulations.save).toHaveBeenCalledTimes(1);
      expect(deps.simulation.result).toBe(recorded);
    },
  );

  it('recalculates after an offer terms change', async () => {
    const { offer, simulation, simulations, execute } = setup();
    await execute();
    offer
      .markPersisted()
      .edit({ maturityDate: offer.maturityDate.addDays(-1) }, NOW);

    expect((await execute()).isOk()).toBe(true);

    expect(simulations.save).toHaveBeenCalledTimes(2);
    expect(simulation.calculation.inputs.offerTermsRevision).toBe(2);
  });

  it('skips an invalid outcome recorded for the current inputs', async () => {
    const curve = cdiCurve();
    const deps = setup(curve.id);
    deps.offers.findById.mockResolvedValue(Result.ok(uncoveredCdiOffer()));
    deps.curves.findById.mockResolvedValue(Result.ok(curve));
    await deps.execute();

    expect((await deps.execute()).isOk()).toBe(true);

    expect(deps.simulation.calculation.status).toBe(
      ESimulationCalculationStatus.INVALID,
    );
    expect(deps.simulations.save).toHaveBeenCalledTimes(1);
  });

  it('skips an invalid outcome whose premise is still missing', async () => {
    const deps = setup();
    deps.offers.findById.mockResolvedValue(
      Result.err(new OfferNotFoundError('offer-id')),
    );
    await deps.execute();

    expect((await deps.execute()).isOk()).toBe(true);

    expect(deps.simulations.save).toHaveBeenCalledTimes(1);
  });

  it('calculates a failed calculation again', async () => {
    const { simulation, simulations, execute } = setup();
    simulation.markCalculationFailed(NOW);

    expect((await execute()).isOk()).toBe(true);

    expect(simulations.save).toHaveBeenCalledWith(simulation);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );
  });

  it('acknowledges a deleted simulation without effect', async () => {
    const { simulations, offers, execute } = setup();
    simulations.findById.mockResolvedValue(
      Result.err(new SimulationNotFoundError('simulation-id')),
    );

    expect((await execute()).isOk()).toBe(true);
    expect(offers.findById).not.toHaveBeenCalled();
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('discards an outcome that a newer change made stale', async () => {
    const { simulations, execute } = setup();
    simulations.save.mockResolvedValue(
      Result.err(new SimulationCalculationStaleError('simulation-id', 1)),
    );

    expect((await execute()).isOk()).toBe(true);
  });

  it('returns technical failures so the queue retries', async () => {
    const { simulations, offers, execute } = setup();
    offers.findById.mockResolvedValue(Result.err(FAILURE));
    expect((await execute()).error).toBe(FAILURE);
    expect(simulations.save).not.toHaveBeenCalled();

    offers.findById.mockResolvedValue(Result.ok(catalogOffer()));
    simulations.findById.mockResolvedValue(Result.err(FAILURE));
    expect((await execute()).error).toBe(FAILURE);
  });

  it('returns a failed save so the queue retries', async () => {
    const { simulations, execute } = setup();
    simulations.save.mockResolvedValue(Result.err(FAILURE));

    expect((await execute()).error).toBe(FAILURE);
  });
});
