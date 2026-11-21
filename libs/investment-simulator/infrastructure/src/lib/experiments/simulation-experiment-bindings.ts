import { SimulationRepository } from '@investflow/investment-simulator-application';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import { DomainEventRecorder } from '@investflow/shared-domain';
import {
  experimentsConfig,
  type ExperimentsConfig,
  PrismaService,
} from '@investflow/shared-infrastructure';
import { FactoryProvider } from '@nestjs/common';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';
import { IncomeTaxOmittingInvestmentCalculator } from './income-tax-omitting-investment-calculator';
import { RevisionUnguardedSimulationRepository } from './revision-unguarded-simulation.repository';

// The only place the simulations choose between their production
// implementations and the experiments' ones.
export const simulationRepositoryBinding: FactoryProvider<SimulationRepository> =
  {
    provide: SimulationRepository,
    useFactory: (
      prisma: PrismaService,
      events: DomainEventRecorder,
      experiments: ExperimentsConfig,
    ): SimulationRepository =>
      experiments.isRevisionGuardSkipped
        ? new RevisionUnguardedSimulationRepository(prisma, events)
        : new PrismaSimulationRepository(prisma, events),
    inject: [PrismaService, DomainEventRecorder, experimentsConfig.KEY],
  };

export const investmentCalculatorBinding: FactoryProvider<InvestmentCalculator> =
  {
    provide: InvestmentCalculator,
    useFactory: (experiments: ExperimentsConfig): InvestmentCalculator =>
      experiments.hasLogicError
        ? new IncomeTaxOmittingInvestmentCalculator()
        : new InvestmentCalculator(),
    inject: [experimentsConfig.KEY],
  };
