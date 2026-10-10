import {
  IndexCurveNotFoundError,
  IndexCurveRepository,
} from '@investflow/investment-simulator-application';
import { IndexCurve } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { IndexCurveMapper } from './index-curve.mapper';

@Injectable()
export class PrismaIndexCurveRepository
  extends BaseRepository<IndexCurve>
  implements IndexCurveRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<
    Result<IndexCurve, IndexCurveNotFoundError | RepositoryFindError>
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.indexCurve.findUnique({
          where: { id, deletedAt: null },
          include: { intervals: { orderBy: { startDate: 'asc' } } },
        });
        return record ? IndexCurveMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('IndexCurve', id, error),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new IndexCurveNotFoundError(id));
  }

  protected async persistAggregate(
    curve: IndexCurve,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = IndexCurveMapper.toPersistence(curve);
    await client.indexCurve.upsert({
      where: { id: curve.id },
      create: data,
      update: curve.deletedAt ? { deletedAt: curve.deletedAt.date } : {},
    });
  }
}
