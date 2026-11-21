import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  AddInvestmentPlanSimulationsUseCase,
  BuildInvestmentPlanStatusesUseCase,
  BuildInvestmentPlanTotalsUseCase,
  CreateInvestmentPlanUseCase,
  DeleteInvestmentPlanUseCase,
  EditInvestmentPlanUseCase,
  InvestmentPlanMemberReader,
  InvestmentPlanRepository,
  RemoveInvestmentPlanSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { InvestmentPlanTotalsCalculator } from '@investflow/investment-simulator-domain';
import { experimentsConfig } from '@investflow/shared-infrastructure';
import { simulationRepositoryBinding } from '../experiments/simulation-experiment-bindings';
import { InvestmentPlanController } from './http/investment-plan.controller';
import { PrismaInvestmentPlanMemberReader } from './persistence/prisma-investment-plan-member-reader';
import { PrismaInvestmentPlanRepository } from './persistence/prisma-investment-plan.repository';
import { GetInvestmentPlanQueryHandler } from './queries/get-investment-plan.query-handler';
import { ListInvestmentPlansQueryHandler } from './queries/list-investment-plans.query-handler';

// Needs Clock and PrismaService from the host. Binds the simulation
// repository itself: an imported module cannot see its importer's providers.
@Module({
  imports: [ConfigModule.forFeature(experimentsConfig)],
  controllers: [InvestmentPlanController],
  providers: [
    {
      provide: InvestmentPlanRepository,
      useClass: PrismaInvestmentPlanRepository,
    },
    simulationRepositoryBinding,
    {
      provide: InvestmentPlanMemberReader,
      useClass: PrismaInvestmentPlanMemberReader,
    },
    {
      provide: InvestmentPlanTotalsCalculator,
      useValue: new InvestmentPlanTotalsCalculator(),
    },
    CreateInvestmentPlanUseCase,
    EditInvestmentPlanUseCase,
    DeleteInvestmentPlanUseCase,
    AddInvestmentPlanSimulationsUseCase,
    RemoveInvestmentPlanSimulationUseCase,
    BuildInvestmentPlanStatusesUseCase,
    BuildInvestmentPlanTotalsUseCase,
    ListInvestmentPlansQueryHandler,
    GetInvestmentPlanQueryHandler,
  ],
})
export class InvestmentPlansModule {}
