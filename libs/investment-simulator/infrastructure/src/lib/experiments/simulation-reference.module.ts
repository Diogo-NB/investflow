import {
  CurveRepository,
  OfferRepository,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import {
  InvestmentCalculator,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Module } from '@nestjs/common';
import { PrismaCurveRepository } from '../curves/persistence/prisma-curve.repository';
import { PrismaOfferRepository } from '../offers/persistence/prisma-offer.repository';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';

// What the experiments' oracle reads simulations and recalculates them with.
// Always the production implementations, never the experiment bindings: the
// oracle's reference must not carry the fault under test.
@Module({
  providers: [
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    { provide: OfferRepository, useClass: PrismaOfferRepository },
    { provide: CurveRepository, useClass: PrismaCurveRepository },
    {
      provide: SimulationCalculationService,
      useFactory: () =>
        new SimulationCalculationService(new InvestmentCalculator()),
    },
  ],
  exports: [
    SimulationRepository,
    SimulationCalculationService,
    OfferRepository,
    CurveRepository,
  ],
})
export class SimulationReferenceModule {}
