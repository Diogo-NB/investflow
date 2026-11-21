import { CurveNotFoundError } from '@investflow/investment-simulator-application';
import { Curve, EEconomicIndex } from '@investflow/investment-simulator-domain';
import {
  DomainEvent,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import {
  EExperimentEventContent,
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import { PrismaCurveRepository } from '../../curves/persistence/prisma-curve.repository';
import {
  type CompleteCurveCopyFields,
  type ContentCarryingEventContent,
  CurveContentEvent,
  curveCopyFieldsOf,
  type CurveCopyFields,
} from './premise-content.events';

const copiedEventTypes = new Set([
  'CurveCreated',
  'CurveValuesChanged',
  'CurveDeleted',
]);

// As ContentCarryingOfferRepository, for curves.
export class ContentCarryingCurveRepository extends PrismaCurveRepository {
  private readonly storedFields = new WeakMap<Curve, CompleteCurveCopyFields>();

  constructor(
    prisma: PrismaService,
    events: DomainEventRecorder,
    private readonly content: ContentCarryingEventContent,
  ) {
    super(prisma, events);
  }

  override async findById(
    id: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    return this.remembered(await super.findById(id));
  }

  override async findSystemCurve(
    index: EEconomicIndex,
    name: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    return this.remembered(await super.findSystemCurve(index, name));
  }

  protected override eventsToRecord(curve: Curve): DomainEvent[] {
    const current = curveCopyFieldsOf(curve);
    const stored = this.storedFields.get(curve) ?? null;
    this.storedFields.set(curve, current);
    return super
      .eventsToRecord(curve)
      .map((event) =>
        copiedEventTypes.has(event.eventType)
          ? new CurveContentEvent(
              event,
              this.content,
              curve.revision,
              curve.valuesRevision,
              this.fieldsToSend(current, stored),
            )
          : event,
      );
  }

  private remembered(
    found: Result<Curve, CurveNotFoundError | RepositoryFindError>,
  ): Result<Curve, CurveNotFoundError | RepositoryFindError> {
    if (found.isOk())
      this.storedFields.set(found.value, curveCopyFieldsOf(found.value));
    return found;
  }

  private fieldsToSend(
    current: CompleteCurveCopyFields,
    stored: CompleteCurveCopyFields | null,
  ): CurveCopyFields {
    if (this.content === EExperimentEventContent.STATE || !stored)
      return current;
    return {
      ...(current.index !== stored.index && { index: current.index }),
      ...(JSON.stringify(current.intervals) !==
        JSON.stringify(stored.intervals) && { intervals: current.intervals }),
      ...(current.isDeleted !== stored.isDeleted && {
        isDeleted: current.isDeleted,
      }),
    };
  }
}
