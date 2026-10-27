import { Module } from '@nestjs/common';
import {
  AddInvestmentPlanSimulationsUseCase,
  CreateInvestmentPlanUseCase,
  DeleteInvestmentPlanUseCase,
  EditInvestmentPlanUseCase,
  InvestmentPlanRepository,
  RemoveInvestmentPlanSimulationUseCase,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';
import { InvestmentPlanController } from './http/investment-plan.controller';
import { PrismaInvestmentPlanRepository } from './persistence/prisma-investment-plan.repository';
import { GetInvestmentPlanQueryHandler } from './queries/get-investment-plan.query-handler';
import { ListInvestmentPlansQueryHandler } from './queries/list-investment-plans.query-handler';

// Needs Clock and PrismaService from the host. Binds the simulation
// repository itself: an imported module cannot see its importer's providers.
@Module({
  controllers: [InvestmentPlanController],
  providers: [
    {
      provide: InvestmentPlanRepository,
      useClass: PrismaInvestmentPlanRepository,
    },
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    CreateInvestmentPlanUseCase,
    EditInvestmentPlanUseCase,
    DeleteInvestmentPlanUseCase,
    AddInvestmentPlanSimulationsUseCase,
    RemoveInvestmentPlanSimulationUseCase,
    ListInvestmentPlansQueryHandler,
    GetInvestmentPlanQueryHandler,
  ],
})
export class InvestmentPlansModule {}
