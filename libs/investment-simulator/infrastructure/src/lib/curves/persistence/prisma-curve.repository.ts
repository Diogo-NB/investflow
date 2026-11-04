import {
  CurveNotFoundError,
  CurveRepository,
} from '@investflow/investment-simulator-application';
import {
  Curve,
  CurveRevisionConflictError,
  EEconomicIndex,
} from '@investflow/investment-simulator-domain';
import { DomainEventRecorder, Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { EconomicIndex as PersistedEconomicIndex } from '@prisma/client';
import { curveInclude, CurveMapper, CurveRecord } from './curve.mapper';

@Injectable()
export class PrismaCurveRepository
  extends BaseRepository<Curve>
  implements CurveRepository
{
  // The revision each aggregate had when it was read or last saved; a curve
  // without one is new.
  private readonly storedRevisions = new WeakMap<Curve, number>();

  constructor(prisma: PrismaService, events: DomainEventRecorder) {
    super(prisma, events);
  }

  findById(
    id: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    return this.findOne(
      () =>
        this.prisma.client.curve.findUnique({
          where: { id, deletedAt: null },
          include: curveInclude,
        }),
      id,
    );
  }

  findSystemCurve(
    index: EEconomicIndex,
    name: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    return this.findOne(
      () =>
        this.prisma.client.curve.findFirst({
          where: {
            ownerId: null,
            index: index as PersistedEconomicIndex,
            name,
            deletedAt: null,
          },
          include: curveInclude,
        }),
      name,
    );
  }

  private async findOne(
    find: () => Promise<CurveRecord | null>,
    identity: string,
  ): Promise<Result<Curve, CurveNotFoundError | RepositoryFindError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await find();
        return record ? CurveMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Curve', identity, error),
    );
    if (result.isErr()) return result;
    if (!result.value) return Result.err(new CurveNotFoundError(identity));
    this.storedRevisions.set(result.value, result.value.revision);
    return Result.ok(result.value);
  }

  protected async persistAggregate(
    curve: Curve,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedRevisions.get(curve);
    if (stored === curve.revision) return;

    // Mapping first rejects an unrepresentable value before any write.
    const intervals = CurveMapper.intervalsToPersistence(curve);
    const data = CurveMapper.toPersistence(curve);
    if (stored === undefined) {
      await client.curve.create({ data });
    } else {
      const { count } = await client.curve.updateMany({
        where: { id: curve.id, revision: stored },
        data,
      });
      if (count === 0) throw new CurveRevisionConflictError(curve.id, stored);
      await client.curveInterval.deleteMany({ where: { curveId: curve.id } });
    }
    await client.curveInterval.createMany({ data: intervals });
    this.storedRevisions.set(curve, curve.revision);
  }
}
