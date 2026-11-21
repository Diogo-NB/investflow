import {
  CalculateSimulationUseCase,
  ComparedSimulationReader,
  CurveRepository,
  FailSimulationCalculationUseCase,
  InvestmentPlanMemberReader,
  OfferRepository,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsUseCase,
  SimulationRepository,
  SimulationResultValidityReader,
} from '@investflow/investment-simulator-application';
import {
  InvestmentCalculator,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import { DomainEventRecorder } from '@investflow/shared-domain';
import {
  EExperimentEventContent,
  experimentsConfig,
  type ExperimentsConfig,
  PrismaService,
} from '@investflow/shared-infrastructure';
import { FactoryProvider, Provider } from '@nestjs/common';
import { PrismaCurveRepository } from '../curves/persistence/prisma-curve.repository';
import { PrismaInvestmentPlanMemberReader } from '../investment-plans/persistence/prisma-investment-plan-member-reader';
import { PrismaOfferRepository } from '../offers/persistence/prisma-offer.repository';
import { PrismaComparedSimulationReader } from '../simulation-comparisons/persistence/prisma-compared-simulation-reader';
import { SimulationRecalculationConsumer } from '../simulations/messaging/simulation-recalculation.consumer';
import { PrismaSimulationResultValidityReader } from '../simulations/persistence/prisma-simulation-result-validity-reader';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';
import { IncomeTaxOmittingInvestmentCalculator } from './income-tax-omitting-investment-calculator';
import { ContentCarryingCurveRepository } from './premise-copies/content-carrying-curve.repository';
import { ContentCarryingOfferRepository } from './premise-copies/content-carrying-offer.repository';
import { CurveCopyRepository } from './premise-copies/curve-copy.repository';
import { OfferCopyRepository } from './premise-copies/offer-copy.repository';
import type { ContentCarryingEventContent } from './premise-copies/premise-content.events';
import { PremiseCopyRecalculationConsumer } from './premise-copies/premise-copy-recalculation.consumer';
import {
  PremiseCopyComparedSimulationReader,
  PremiseCopyInvestmentPlanMemberReader,
  PremiseCopySimulationResultValidityReader,
} from './premise-copies/premise-copy-readers';
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

function contentCarriedBy(
  experiments: ExperimentsConfig,
): ContentCarryingEventContent | null {
  return experiments.eventContent === EExperimentEventContent.NOTIFICATION
    ? null
    : experiments.eventContent;
}

// V2 and V3 on the producer's side: the offer and curve events carry content.
export const offerRepositoryBinding: FactoryProvider<OfferRepository> = {
  provide: OfferRepository,
  useFactory: (
    prisma: PrismaService,
    events: DomainEventRecorder,
    experiments: ExperimentsConfig,
  ): OfferRepository => {
    const content = contentCarriedBy(experiments);
    return content
      ? new ContentCarryingOfferRepository(prisma, events, content)
      : new PrismaOfferRepository(prisma, events);
  },
  inject: [PrismaService, DomainEventRecorder, experimentsConfig.KEY],
};

export const curveRepositoryBinding: FactoryProvider<CurveRepository> = {
  provide: CurveRepository,
  useFactory: (
    prisma: PrismaService,
    events: DomainEventRecorder,
    experiments: ExperimentsConfig,
  ): CurveRepository => {
    const content = contentCarriedBy(experiments);
    return content
      ? new ContentCarryingCurveRepository(prisma, events, content)
      : new PrismaCurveRepository(prisma, events);
  },
  inject: [PrismaService, DomainEventRecorder, experimentsConfig.KEY],
};

// V2 and V3 on the consumer's side: the recalculation consumer, the worker,
// and the dead-letter use case read the simulations' copy, and the screens
// compare with its revisions. Requests that create or edit a simulation keep
// validating against the offer and curve they name.
export const premiseCopyBindings: Provider[] = [
  {
    provide: OfferCopyRepository,
    useFactory: (prisma: PrismaService, experiments: ExperimentsConfig) =>
      new OfferCopyRepository(prisma, !experiments.isRevisionGuardSkipped),
    inject: [PrismaService, experimentsConfig.KEY],
  },
  {
    provide: CurveCopyRepository,
    useFactory: (prisma: PrismaService, experiments: ExperimentsConfig) =>
      new CurveCopyRepository(prisma, !experiments.isRevisionGuardSkipped),
    inject: [PrismaService, experimentsConfig.KEY],
  },
  {
    provide: CalculateSimulationUseCase,
    useFactory: (
      experiments: ExperimentsConfig,
      simulations: SimulationRepository,
      offers: OfferRepository,
      curves: CurveRepository,
      offerCopies: OfferCopyRepository,
      curveCopies: CurveCopyRepository,
      calculation: SimulationCalculationService,
      clock: Clock,
    ) =>
      contentCarriedBy(experiments)
        ? new CalculateSimulationUseCase(
            simulations,
            offerCopies,
            curveCopies,
            calculation,
            clock,
          )
        : new CalculateSimulationUseCase(
            simulations,
            offers,
            curves,
            calculation,
            clock,
          ),
    inject: [
      experimentsConfig.KEY,
      SimulationRepository,
      OfferRepository,
      CurveRepository,
      OfferCopyRepository,
      CurveCopyRepository,
      SimulationCalculationService,
      Clock,
    ],
  },
  {
    provide: FailSimulationCalculationUseCase,
    useFactory: (
      experiments: ExperimentsConfig,
      simulations: SimulationRepository,
      offers: OfferRepository,
      curves: CurveRepository,
      offerCopies: OfferCopyRepository,
      curveCopies: CurveCopyRepository,
      clock: Clock,
    ) =>
      contentCarriedBy(experiments)
        ? new FailSimulationCalculationUseCase(
            simulations,
            offerCopies,
            curveCopies,
            clock,
          )
        : new FailSimulationCalculationUseCase(
            simulations,
            offers,
            curves,
            clock,
          ),
    inject: [
      experimentsConfig.KEY,
      SimulationRepository,
      OfferRepository,
      CurveRepository,
      OfferCopyRepository,
      CurveCopyRepository,
      Clock,
    ],
  },
  {
    provide: SimulationRecalculationConsumer,
    useFactory: (
      experiments: ExperimentsConfig,
      offerCopies: OfferCopyRepository,
      curveCopies: CurveCopyRepository,
      recalculateOffer: RecalculateOfferSimulationsUseCase,
      recalculateCurve: RecalculateCurveSimulationsUseCase,
    ) =>
      contentCarriedBy(experiments)
        ? new PremiseCopyRecalculationConsumer(
            offerCopies,
            curveCopies,
            recalculateOffer,
            recalculateCurve,
          )
        : new SimulationRecalculationConsumer(
            recalculateOffer,
            recalculateCurve,
          ),
    inject: [
      experimentsConfig.KEY,
      OfferCopyRepository,
      CurveCopyRepository,
      RecalculateOfferSimulationsUseCase,
      RecalculateCurveSimulationsUseCase,
    ],
  },
  {
    provide: SimulationResultValidityReader,
    useFactory: (experiments: ExperimentsConfig, prisma: PrismaService) =>
      contentCarriedBy(experiments)
        ? new PremiseCopySimulationResultValidityReader(prisma)
        : new PrismaSimulationResultValidityReader(prisma),
    inject: [experimentsConfig.KEY, PrismaService],
  },
  {
    provide: ComparedSimulationReader,
    useFactory: (experiments: ExperimentsConfig, prisma: PrismaService) =>
      contentCarriedBy(experiments)
        ? new PremiseCopyComparedSimulationReader(prisma)
        : new PrismaComparedSimulationReader(prisma),
    inject: [experimentsConfig.KEY, PrismaService],
  },
];

export const investmentPlanMemberReaderBinding: FactoryProvider<InvestmentPlanMemberReader> =
  {
    provide: InvestmentPlanMemberReader,
    useFactory: (experiments: ExperimentsConfig, prisma: PrismaService) =>
      contentCarriedBy(experiments)
        ? new PremiseCopyInvestmentPlanMemberReader(prisma)
        : new PrismaInvestmentPlanMemberReader(prisma),
    inject: [experimentsConfig.KEY, PrismaService],
  };
