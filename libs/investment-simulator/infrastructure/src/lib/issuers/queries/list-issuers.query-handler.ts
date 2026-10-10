import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { AppError, EAppErrorCode, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';

export interface IssuerListItem {
  readonly id: string;
  readonly name: string;
}

export type ListIssuersOutput = IssuerListItem[];

export class IssuerQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar os emissores.', {
      code: EAppErrorCode.ISSUER_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}

@Injectable()
export class ListIssuersQueryHandler
  implements QueryHandler<void, ListIssuersOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(): Promise<Result<ListIssuersOutput, IssuerQueryError>> {
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
