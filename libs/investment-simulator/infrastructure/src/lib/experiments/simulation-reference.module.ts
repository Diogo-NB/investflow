import { SimulationRepository } from '@investflow/investment-simulator-application';
import {
  InvestmentCalculator,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Module } from '@nestjs/common';
import { CurvesModule } from '../curves/curves.module';
import { OffersModule } from '../offers/offers.module';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';

// What the experiments' oracle reads simulations and recalculates them with.
// Always the production implementations, never the experiment bindings: the
// oracle's reference must not carry the fault under test.
@Module({
  imports: [CurvesModule, OffersModule],
  providers: [
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    {
      provide: SimulationCalculationService,
      useFactory: () =>
        new SimulationCalculationService(new InvestmentCalculator()),
    },
  ],
  exports: [
    SimulationRepository,
    SimulationCalculationService,
    CurvesModule,
    OffersModule,
  ],
})
export class SimulationReferenceModule {}
