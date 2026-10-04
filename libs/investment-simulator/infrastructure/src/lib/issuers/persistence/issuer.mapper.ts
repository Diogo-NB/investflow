import { Issuer } from '@investflow/investment-simulator-domain';
import type { InvestmentIssuer } from '@prisma/client';

export interface IssuerPersistenceData {
  readonly id: string;
  readonly name: string;
}

export class IssuerMapper {
  static toDomain(record: InvestmentIssuer): Issuer {
    return Issuer.reconstitute({ id: record.id, name: record.name });
  }

  static toPersistence(issuer: Issuer): IssuerPersistenceData {
    return { id: issuer.id, name: issuer.name };
  }
}
