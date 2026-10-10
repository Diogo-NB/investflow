import { EAppErrorCode } from '@investflow/shared-domain';
import { Issuer } from '@investflow/investment-simulator-domain';
import {
  PrismaService,
  RepositoryFindError,
  RepositorySaveError,
} from '@investflow/shared-infrastructure';
import type { InvestmentIssuer } from '@prisma/client';
import { IssuerMapper } from './issuer.mapper';
import { PrismaIssuerRepository } from './prisma-issuer.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

function createFixture() {
  const findUnique = jest.fn();
  const upsert = jest.fn().mockResolvedValue(undefined);
  const createMany = jest.fn();
  const client = {
    investmentIssuer: { findUnique, upsert },
    outboxEvent: { createMany },
  };
  return {
    repository: new PrismaIssuerRepository({
      client,
    } as unknown as PrismaService),
    findUnique,
    upsert,
    createMany,
  };
}

const record: InvestmentIssuer = {
  id: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
  name: 'Banco',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('PrismaIssuerRepository', () => {
  it('finds and maps an issuer', async () => {
    const fixture = createFixture();
    fixture.findUnique.mockResolvedValue(record);

    const result = await fixture.repository.findById(record.id);

    expect(result.isOk()).toBe(true);
    expect(result.value.name).toBe('Banco');
    expect(fixture.findUnique).toHaveBeenCalledWith({
      where: { id: record.id },
    });
  });

  it('returns IssuerNotFoundError when absent', async () => {
    const fixture = createFixture();
    fixture.findUnique.mockResolvedValue(null);

    const result = await fixture.repository.findById(record.id);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe(EAppErrorCode.ISSUER_NOT_FOUND);
  });

  it('wraps unexpected read failures', async () => {
    const fixture = createFixture();
    const cause = new Error('read failed');
    fixture.findUnique.mockRejectedValue(cause);

    const result = await fixture.repository.findById(record.id);

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositoryFindError);
    expect(result.error.cause).toBe(cause);
  });

  it('wraps mapper failures and preserves their cause', async () => {
    const fixture = createFixture();
    fixture.findUnique.mockResolvedValue(record);
    const cause = new Error('mapping failed');
    const mapper = jest
      .spyOn(IssuerMapper, 'toDomain')
      .mockImplementationOnce(() => {
        throw cause;
      });

    try {
      const result = await fixture.repository.findById(record.id);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RepositoryFindError);
      expect(result.error.cause).toBe(cause);
    } finally {
      mapper.mockRestore();
    }
  });

  it('upserts issuer state without technical timestamps or outbox writes', async () => {
    const fixture = createFixture();
    const issuer = Issuer.reconstitute({ id: record.id, name: 'Banco' });

    const result = await fixture.repository.save(issuer);

    expect(result.isOk()).toBe(true);
    expect(fixture.upsert).toHaveBeenCalledWith({
      where: { id: record.id },
      create: { id: record.id, name: 'Banco' },
      update: { name: 'Banco' },
    });
    expect(fixture.createMany).not.toHaveBeenCalled();
  });

  it('maps write failures to RepositorySaveError', async () => {
    const fixture = createFixture();
    fixture.upsert.mockRejectedValue(new Error('write failed'));

    const result = await fixture.repository.save(
      Issuer.reconstitute({ id: record.id, name: 'Banco' }),
    );

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
  });
});
