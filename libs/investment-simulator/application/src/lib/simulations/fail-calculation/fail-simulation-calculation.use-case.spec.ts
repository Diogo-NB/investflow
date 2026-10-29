import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  InvestmentCalculator,
  Offer,
  Simulation,
  SimulationCalculationService,
  SimulationCalculationStaleError,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { catalogOffer, ownedSimulation } from '../shared/simulation-fixture';
import { FailSimulationCalculationCommand } from './fail-simulation-calculation.command';
import { FailSimulationCalculationUseCase } from './fail-simulation-calculation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');
const CALCULATED_AT = UtcInstant.ofIso('2026-10-09T12:00:00Z');
const calculation = new SimulationCalculationService(
  new InvestmentCalculator(),
);

function setup() {
  const offer = catalogOffer();
  const simulation = ownedSimulation(offer.id);
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
  const useCase = new FailSimulationCalculationUseCase(
    simulations,
    offers,
    curves,
    { now: () => NOW } as unknown as Clock,
  );
  const execute = () =>
    useCase.execute(FailSimulationCalculationCommand.of(simulation.id));
  return { offer, simulation, simulations, offers, execute };
}

function recordCalculated(simulation: Simulation, offer: Offer): void {
  simulation.recordCalculation(
    calculation.calculate(simulation, offer, null, CALCULATED_AT),
    CALCULATED_AT,
  );
}

describe('FailSimulationCalculationUseCase', () => {
  it('marks a pending calculation as failed', async () => {
    const { simulation, simulations, execute } = setup();

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.FAILED,
    );
    expect(simulation.calculation.changedAt).toBe(NOW);
    expect(simulations.save).toHaveBeenCalledWith(simulation);
  });

  it('marks a result made stale by an offer change as failed', async () => {
    const { offer, simulation, simulations, execute } = setup();
    recordCalculated(simulation, offer);
    offer.markPersisted();
    offer.edit({ maturityDate: CalendarDate.of('2031-01-02') }, NOW);

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.FAILED,
    );
    expect(simulation.calculation.cause.kind).toBe(
      ESimulationCalculationCauseKind.CREATED,
    );
    expect(simulations.save).toHaveBeenCalledWith(simulation);
  });

  it('leaves a result that is current for the premises', async () => {
    const { offer, simulation, simulations, execute } = setup();
    recordCalculated(simulation, offer);

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('leaves the invalid outcome recorded for a deleted offer', async () => {
    const { simulation, simulations, offers, execute } = setup();
    const missing = new OfferNotFoundError(simulation.offerId);
    offers.findById.mockResolvedValue(Result.err(missing));
    simulation.recordCalculation(
      {
        kind: 'INVALID',
        simulationRevision: simulation.revision,
        inputFingerprint: SimulationCalculationService.inputFingerprintOf(
          simulation,
          null,
        ),
        reason: missing,
      },
      CALCULATED_AT,
    );

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.INVALID,
    );
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('leaves a calculation that already failed', async () => {
    const { simulation, simulations, offers, execute } = setup();
    simulation.markCalculationFailed(CALCULATED_AT);

    expect((await execute()).isOk()).toBe(true);

    expect(simulation.calculation.changedAt).toBe(CALCULATED_AT);
    expect(offers.findById).not.toHaveBeenCalled();
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('returns a failed premise lookup so the queue retries', async () => {
    const { simulations, offers, execute } = setup();
    const failure = new AppError('Falhou.', {
      code: EAppErrorCode.REPOSITORY_FIND_FAILED,
      kind: 'infrastructure',
    });
    offers.findById.mockResolvedValue(Result.err(failure));

    expect((await execute()).error).toBe(failure);
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('acknowledges a deleted simulation or a newer change', async () => {
    const { simulations, execute } = setup();
    simulations.save.mockResolvedValue(
      Result.err(new SimulationCalculationStaleError('simulation-id', 1)),
    );
    expect((await execute()).isOk()).toBe(true);

    simulations.findById.mockResolvedValue(
      Result.err(new SimulationNotFoundError('simulation-id')),
    );
    expect((await execute()).isOk()).toBe(true);
  });
});
