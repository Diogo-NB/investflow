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
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationNotFoundError } from '../simulation-not-found.error';
import { SimulationRepository } from '../simulation.repository';
import {
  cdiCurve,
  investmentRequest,
  ownedSimulation,
  OWNER_ID,
} from '../shared/simulation-fixture';
import { CalculateSimulationCommand } from './calculate-simulation.command';
import { CalculateSimulationUseCase } from './calculate-simulation.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup(simulation = ownedSimulation()) {
  const simulations = {
    findById: jest.fn().mockResolvedValue(Result.ok(simulation)),
    save: jest.fn(),
  } as unknown as jest.Mocked<SimulationRepository>;
  const calculations = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  } as unknown as jest.Mocked<SimulationCalculationRepository>;
  const curves = {
    findById: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<IndexCurveRepository>;
  const clock = { now: () => NOW } as unknown as Clock;
  const useCase = new CalculateSimulationUseCase(
    simulations,
    calculations,
    curves,
    new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    clock,
  );
  return { simulation, simulations, calculations, curves, useCase };
}

function command(ownerId = OWNER_ID, overrides = {}) {
  return CalculateSimulationCommand.fromRequest(
    ownerId,
    { simulationId: 'simulation-id' },
    investmentRequest(overrides),
  );
}

describe('CalculateSimulationUseCase', () => {
  it("appends a calculation of another investment to the requester's simulation", async () => {
    const { simulation, simulations, calculations, useCase } = setup();

    const result = await useCase.execute(
      command(OWNER_ID, { principal: '2000' }),
    );

    const calculation = calculations.save.mock
      .calls[0][0] as SimulationCalculation;
    expect(simulations.findById).toHaveBeenCalledWith(
      'simulation-id',
      OWNER_ID,
    );
    expect(simulations.save).not.toHaveBeenCalled();
    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.investment.principal.equals(Money.of('2000'))).toBe(
      true,
    );
    expect(calculation.calculatedAt).toBe(NOW);
    expect(result.value).toEqual({
      simulationId: simulation.id,
      calculationId: calculation.id,
    });
  });

  it('loads the curve the investment references', async () => {
    const { curves, calculations, useCase } = setup(
      ownedSimulation('CDI_PERCENTAGE'),
    );
    const curve = cdiCurve();
    curves.findById.mockResolvedValue(Result.ok(curve));

    await useCase.execute(command(OWNER_ID, { indexCurveId: curve.id }));

    expect(curves.findById).toHaveBeenCalledWith(curve.id);
    expect(calculations.save).toHaveBeenCalled();
  });

  it('saves nothing when the calculation is rejected', async () => {
    const { calculations, useCase } = setup();

    const result = await useCase.execute(command(OWNER_ID, { principal: '0' }));

    expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it('rejects a deleted simulation', async () => {
    const { simulation, calculations, useCase } = setup();
    simulation.delete(NOW);

    const result = await useCase.execute(command());

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_DELETED);
    expect(calculations.save).not.toHaveBeenCalled();
  });

  it("stops at another owner's simulation", async () => {
    const { simulations, calculations, useCase } = setup();
    simulations.findById.mockResolvedValue(
      Result.err(new SimulationNotFoundError('simulation-id')),
    );

    const result = await useCase.execute(command('someone-else'));

    expect(simulations.findById).toHaveBeenCalledWith(
      'simulation-id',
      'someone-else',
    );
    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
    expect(calculations.save).not.toHaveBeenCalled();
  });
});
