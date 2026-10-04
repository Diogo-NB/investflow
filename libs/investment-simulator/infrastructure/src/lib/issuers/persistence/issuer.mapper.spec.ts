import { Issuer } from '@investflow/investment-simulator-domain';
import type { InvestmentIssuer } from '@prisma/client';
import { IssuerMapper } from './issuer.mapper';

describe('IssuerMapper', () => {
  const record: InvestmentIssuer = {
    id: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
    name: '  Banco Exemplo  ',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
  };

  it('maps persistence to domain without technical timestamps', () => {
    const issuer = IssuerMapper.toDomain(record);

    expect(issuer.id).toBe(record.id);
    expect(issuer.name).toBe(record.name);
    expect(issuer).not.toHaveProperty('createdAt');
    expect(issuer).not.toHaveProperty('updatedAt');
  });

  it('maps only domain state to persistence', () => {
    const issuer = Issuer.reconstitute({ id: record.id, name: record.name });

    expect(IssuerMapper.toPersistence(issuer)).toEqual({
      id: record.id,
      name: record.name,
    });
  });
});
