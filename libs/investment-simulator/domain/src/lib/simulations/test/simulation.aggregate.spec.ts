import { EAppErrorCode, Money, UtcInstant } from '@investflow/shared-domain';
import { InvestmentCalculationError } from '../../calculations/investment-calculation.error';
import { Offer } from '../../offers/offer.aggregate';
import { ETitleType } from '../../offers/title-type.enum';
import { InvestmentInputs } from '../investment-inputs.vo';
import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  SimulationCalculation,
  SimulationCalculationOutcome,
} from '../simulation-calculation.vo';
import { SimulationResult } from '../simulation-result.vo';
import { Simulation } from '../simulation.aggregate';
import { SimulationCreated } from '../simulation.events';
import {
  CALCULATED_AT,
  calculationService,
  cause,
  investment,
  offer,
} from './simulation-fixture';

const LATER = UtcInstant.ofIso('2026-10-11T12:00:00Z');
const EDITED = cause(ESimulationCalculationCauseKind.SIMULATION_EDITED);

function create(
  options: { offer?: Offer; investment?: InvestmentInputs } = {},
) {
  const simulation = Simulation.create(
    {
      ownerId: 'owner-id',
      offerId: (options.offer ?? offer()).id,
      investment: options.investment ?? investment(),
    },
    cause(),
    CALCULATED_AT,
  );
  simulation.markPersisted();
  return simulation;
}

function calculated(simulation: Simulation, chosen: Offer = offer()) {
  return calculationService.calculate(simulation, chosen, null, LATER);
}

function invalid(simulationRevision: number): SimulationCalculationOutcome {
  return {
    kind: 'INVALID',
    simulationRevision,
    inputFingerprint: SimulationResult.inputFingerprintFor({
      simulationRevision,
      offer: { titleType: ETitleType.CDB, termsRevision: 1 },
      curveValuesRevision: 1,
    }),
    reason: new InvestmentCalculationError(
      EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
      'Sem cobertura.',
      { missing: [] },
    ),
  };
}

describe('Simulation', () => {
  it('is created at revision 1 waiting for its calculation', () => {
    const chosen = offer();

    const simulation = Simulation.create(
      { ownerId: 'owner-id', offerId: chosen.id, investment: investment() },
      cause(),
      CALCULATED_AT,
    );

    expect(simulation.ownerId).toBe('owner-id');
    expect(simulation.offerId).toBe(chosen.id);
    expect(simulation.revision).toBe(1);
    expect(simulation.result).toBeNull();
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual(cause());
    expect(simulation.calculation.changedAt).toBe(CALCULATED_AT);
    expect(simulation.calculation.simulationRevision).toBe(1);
    const events = simulation.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SimulationCreated);
    expect(events[0].aggregateId).toBe(simulation.id);
  });

  it('increments its revision and queues a calculation when edited', () => {
    const simulation = create();
    const other = offer();

    simulation.edit(
      { offerId: other.id, investment: investment() },
      EDITED,
      LATER,
    );

    expect(simulation.offerId).toBe(other.id);
    expect(simulation.revision).toBe(2);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual(EDITED);
    expect(simulation.calculation.simulationRevision).toBe(2);
    expect(
      simulation.getDomainEvents().map(({ eventType }) => eventType),
    ).toEqual(['SimulationEdited']);
  });

  it('queues a calculation without a new revision when nothing changed', () => {
    const chosen = offer();
    const simulation = create({ offer: chosen });
    simulation.recordCalculation(calculated(simulation, chosen), LATER);

    simulation.edit(
      { offerId: chosen.id, investment: investment() },
      EDITED,
      LATER,
    );

    expect(simulation.revision).toBe(1);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(
      simulation.getDomainEvents().map(({ eventType }) => eventType),
    ).toEqual(['SimulationEdited']);
  });

  it('queues a calculation on request', () => {
    const simulation = create();
    const retry = cause(ESimulationCalculationCauseKind.RETRY_REQUESTED);

    simulation.markCalculationFailed(LATER);
    simulation.requestCalculation(retry, LATER);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(simulation.calculation.cause).toEqual(retry);
    expect(
      simulation.getDomainEvents().map(({ eventType }) => eventType),
    ).toEqual(['SimulationCalculationRequested']);
  });

  it('records a calculated outcome and keeps its cause', () => {
    const simulation = create();
    const outcome = calculated(simulation);

    expect(simulation.recordCalculation(outcome, LATER).isOk()).toBe(true);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );
    expect(simulation.calculation.cause).toEqual(cause());
    expect(simulation.calculation.changedAt).toBe(LATER);
    expect(simulation.calculation.simulationRevision).toBe(1);
    expect(
      simulation.calculation.inputFingerprint?.equals(
        SimulationResult.inputFingerprintFor({
          simulationRevision: 1,
          offer: { titleType: ETitleType.CDB, termsRevision: 1 },
          curveValuesRevision: null,
        }),
      ),
    ).toBe(true);
    expect(outcome.kind === 'CALCULATED' && simulation.result).toBe(
      outcome.kind === 'CALCULATED' && outcome.result,
    );
  });

  it('keeps the last result when an outcome is invalid', () => {
    const simulation = create();
    simulation.recordCalculation(calculated(simulation), LATER);
    const before = simulation.result;

    simulation.recordCalculation(invalid(1), LATER);

    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.INVALID,
    );
    expect(simulation.calculation.reason).toEqual({
      code: EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
      metadata: { missing: [] },
    });
    expect(simulation.result).toBe(before);
  });

  it('refuses an outcome for another revision or once deleted', () => {
    const simulation = create();
    const outcome = calculated(simulation);
    simulation.edit(
      {
        offerId: simulation.offerId,
        investment: investment({ principal: Money.of('2000') }),
      },
      EDITED,
      LATER,
    );

    expect(simulation.recordCalculation(outcome, LATER).error.code).toBe(
      EAppErrorCode.SIMULATION_CALCULATION_STALE,
    );
    simulation.delete(LATER);
    expect(
      simulation.recordCalculation(invalid(simulation.revision), LATER).error
        .code,
    ).toBe(EAppErrorCode.SIMULATION_CALCULATION_STALE);
  });

  it('fails a calculation only while it is pending', () => {
    const simulation = create();
    simulation.markCalculationFailed(LATER);
    expect(simulation.calculation.status).toBe(
      ESimulationCalculationStatus.FAILED,
    );

    const done = create();
    done.recordCalculation(calculated(done), LATER);
    done.markCalculationFailed(LATER);
    expect(done.calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );
  });

  it('gives all changes before a save one revision, and a new one after it', () => {
    const fresh = Simulation.create(
      { ownerId: 'owner-id', offerId: offer().id, investment: investment() },
      cause(),
      CALCULATED_AT,
    );
    fresh.edit(
      { offerId: offer().id, investment: investment() },
      EDITED,
      LATER,
    );
    expect(fresh.revision).toBe(1);
    expect(fresh.calculation.simulationRevision).toBe(1);

    const simulation = create();
    simulation.edit(
      { offerId: offer().id, investment: investment() },
      EDITED,
      LATER,
    );
    simulation.edit(
      {
        offerId: simulation.offerId,
        investment: investment({ principal: Money.of('2000') }),
      },
      EDITED,
      LATER,
    );
    expect(simulation.revision).toBe(2);
    expect(simulation.calculation.simulationRevision).toBe(2);

    simulation.markPersisted().delete(LATER);
    expect(simulation.revision).toBe(3);
  });

  it('reports a stale revision as a conflict', () => {
    const simulation = create();

    expect(simulation.assertRevision(1).isOk()).toBe(true);
    expect(simulation.assertRevision(2).error.code).toBe(
      EAppErrorCode.SIMULATION_REVISION_CONFLICT,
    );
  });

  it('rejects edits and calculation requests once deleted', () => {
    const simulation = create();
    simulation.delete(CALCULATED_AT);

    expect(
      simulation.edit(
        { offerId: simulation.offerId, investment: investment() },
        EDITED,
        LATER,
      ).error.code,
    ).toBe(EAppErrorCode.SIMULATION_DELETED);
    expect(simulation.requestCalculation(EDITED, LATER).error.code).toBe(
      EAppErrorCode.SIMULATION_DELETED,
    );
  });

  it('soft deletes idempotently and keeps the first instant', () => {
    const simulation = create();

    simulation.delete(CALCULATED_AT);
    simulation.delete(LATER);

    expect(simulation.deletedAt).toBe(CALCULATED_AT);
    expect(simulation.revision).toBe(2);
  });

  it('reconstitutes its identity and state', () => {
    const calculation = SimulationCalculation.pending(cause(), 4, LATER);
    const simulation = Simulation.reconstitute({
      id: 'simulation-id',
      ownerId: 'owner-id',
      offerId: 'offer-id',
      investment: investment(),
      revision: 4,
      calculation,
      result: null,
      deletedAt: CALCULATED_AT,
    });

    expect(simulation.id).toBe('simulation-id');
    expect(simulation.revision).toBe(4);
    expect(simulation.calculation).toBe(calculation);
    expect(simulation.result).toBeNull();
    expect(simulation.deletedAt).toBe(CALCULATED_AT);
  });
});
