import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';

export interface IssuerReadModel {
  readonly id: string;
  readonly name: string;
}

export class IssuerQueryError extends AppError {
  constructor(cause: unknown) {
    super('Failed to read issuers', {
      code: 'ISSUER_QUERY_FAILED',
      kind: 'infrastructure',
      cause,
    });
  }
}

@Injectable()
export class ListIssuersQueryHandler
  implements QueryHandler<void, IssuerReadModel[], IssuerQueryError>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(): Promise<Result<IssuerReadModel[], IssuerQueryError>> {
    return Result.fromPromise(
      () =>
        this.prisma.client.investmentIssuer.findMany({
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      (cause) => new IssuerQueryError(cause),
    );
  }
}
