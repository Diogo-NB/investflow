import {
  ApplicationNotFoundError,
  ApplicationRepository,
} from '@investflow/investment-simulator-application';
import { Application } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { ApplicationMapper } from './application.mapper';

@Injectable()
export class PrismaApplicationRepository
  extends BaseRepository<Application>
  implements ApplicationRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<
    Result<Application, ApplicationNotFoundError | RepositoryFindError>
  > {
    const applicationResult = await Result.fromPromise(
      async () => {
        const record =
          await this.prisma.client.investmentApplication.findUnique({
            where: { id, deletedAt: null },
          });
        return record ? ApplicationMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Application', id, error),
    );

    if (applicationResult.isErr()) return applicationResult;
    return applicationResult.value
      ? Result.ok(applicationResult.value)
      : Result.err(new ApplicationNotFoundError(id));
  }

  protected async persistAggregate(
    application: Application,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = ApplicationMapper.toPersistence(application);
    const { id, ...update } = data;

    await client.investmentApplication.upsert({
      where: { id },
      create: data,
      update,
    });
  }
}
