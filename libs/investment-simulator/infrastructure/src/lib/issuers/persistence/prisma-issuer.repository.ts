import {
  IssuerNotFoundError,
  IssuerRepository,
} from '@investflow/investment-simulator-application';
import { Issuer } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { IssuerMapper } from './issuer.mapper';

@Injectable()
export class PrismaIssuerRepository
  extends BaseRepository<Issuer>
  implements IssuerRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<Result<Issuer, IssuerNotFoundError | RepositoryFindError>> {
    const issuerResult = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentIssuer.findUnique({
          where: { id },
        });

        return record ? IssuerMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Issuer', id, error),
    );

    return issuerResult.andThen((issuer) =>
      issuer ? Result.ok(issuer) : Result.err(new IssuerNotFoundError(id)),
    );
  }

  protected async persistAggregate(
    issuer: Issuer,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = IssuerMapper.toPersistence(issuer);
    await client.investmentIssuer.upsert({
      where: { id: data.id },
      create: data,
      update: { name: data.name },
    });
  }
}
