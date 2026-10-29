import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  InvestmentCalculator,
  SimulationCalculationService,
  Offer,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  EAppErrorCode,
  Money,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import { EditSimulationCommandInput } from '../shared/simulation-command-input.type';
import {
  catalogOffer,
  investmentRequest,
  newOfferRequest,
  ownedSimulation,
  OWNER_ID,
} from '../shared/simulation-fixture';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { EditSimulationCommand } from './edit-simulation.command';
import { EditSimulationUseCase } from './edit-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const offer = catalogOffer();
  const simulation = ownedSimulation(offer.id);
  const simulations = {
    findOwned: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationRepository>;
  const offers = {
    findById: jest.fn().mockResolvedValue(Result.ok(offer)),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<OfferRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<CurveRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new EditSimulationUseCase(
    simulations,
    new SimulationPremisesService(offers, curves, clock),
    new SimulationCalculationService(new InvestmentCalculator()),
    clock,
  );
  return { offer, simulation, simulations, offers, useCase };
}

function command(
  offerId: string,
  overrides: Partial<EditSimulationCommandInput> = {},
) {
  return EditSimulationCommand.fromRequest(
    OWNER_ID,
    { simulationId: 'simulation-id' },
    {
      revision: 1,
      offer: { id: offerId },
      investment: investmentRequest(),
      ...overrides,
    },
  );
}

describe('EditSimulationUseCase', () => {
  it('queues a calculation even when nothing changed', async () => {
    const { offer, simulation, simulations, useCase } = setup();

    const result = await useCase.execute(command(offer.id));

    expect(result.value).toEqual({ revision: 1 });
    expect(simulations.findOwned).toHaveBeenCalledWith(
      'simulation-id',
      OWNER_ID,
    );
    expect(simulations.save).toHaveBeenCalledWith(simulation);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual({
      kind: ESimulationCalculationCauseKind.SIMULATION_EDITED,
      actorId: OWNER_ID,
    });
    expect(simulation.calculation.changedAt).toBe(NOW);
    expect(
      simulation.getDomainEvents().map(({ eventType }) => eventType),
    ).toEqual(['SimulationEdited']);
  });

  it('applies a new investment', async () => {
    const { offer, simulation, useCase } = setup();

    await useCase.execute(
      command(offer.id, {
        investment: investmentRequest({ principal: '2500' }),
      }),
    );

    expect(simulation.revision).toBe(2);
    expect(simulation.calculation.simulationRevision).toBe(2);
    expect(simulation.investment.principal.equals(Money.of('2500'))).toBe(true);
  });

  it('switches to a new private offer saved with the simulation', async () => {
    const { simulation, offers, useCase } = setup();

    const result = await useCase.execute(
      command('', { offer: { new: newOfferRequest() } }),
    );

    expect(result.isOk()).toBe(true);
    const offer = offers.save.mock.calls[0][0] as Offer;
    expect(offer.ownerId).toBe(OWNER_ID);
    expect(simulation.offerId).toBe(offer.id);
  });

  it('reports a stale revision without saving', async () => {
    const { offer, simulations, useCase } = setup();

    const result = await useCase.execute(command(offer.id, { revision: 3 }));

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_REVISION_CONFLICT);
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it('saves nothing when validation rejects it', async () => {
    const { offer, simulation, simulations, offers, useCase } = setup();

    const result = await useCase.execute(
      command(offer.id, {
        investment: investmentRequest({ investmentDate: '2026-01-03' }),
      }),
    );

    expect(result.error.code).toBe(
      EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
    );
    expect(simulation.revision).toBe(1);
    expect(offers.save).not.toHaveBeenCalled();
    expect(simulations.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'simulation',
      (deps: ReturnType<typeof setup>) =>
        deps.simulations.findOwned.mockResolvedValue(
          Result.err(new SimulationNotFoundError('simulation-id')),
        ),
      EAppErrorCode.SIMULATION_NOT_FOUND,
    ],
    [
      'offer',
      (deps: ReturnType<typeof setup>) =>
        deps.offers.findById.mockResolvedValue(
          Result.err(new OfferNotFoundError('offer-id')),
        ),
      EAppErrorCode.OFFER_NOT_FOUND,
    ],
  ])('stops when the %s is missing', async (_, arrange, code) => {
    const deps = setup();
    arrange(deps);

    const result = await deps.useCase.execute(command(deps.offer.id));

    expect(result.error.code).toBe(code);
    expect(deps.simulations.save).not.toHaveBeenCalled();
  });
});
