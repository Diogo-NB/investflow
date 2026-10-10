import { Prisma } from '@prisma/client';
import { ApplicationMapper } from './application.mapper';

const record = {
  id: 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11',
  ownerId: 'owner-id',
  offerSnapshotId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  indexCurveId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
  principal: new Prisma.Decimal('1000.123456789012345678901234567891'),
  investmentDate: new Date('2026-01-02T00:00:00.000Z'),
  deletedAt: null,
  createdAt: new Date('2026-10-10T12:00:00.000Z'),
  updatedAt: new Date('2026-10-10T12:00:00.000Z'),
};

describe('ApplicationMapper', () => {
  it('round-trips every stored field without losing principal precision', () => {
    const application = ApplicationMapper.toDomain(record);

    expect(application.indexCurveId).toBe(record.indexCurveId);
    expect(application.investmentDate.toIsoString()).toBe('2026-01-02');
    expect(ApplicationMapper.toPersistence(application)).toEqual({
      id: record.id,
      ownerId: record.ownerId,
      offerSnapshotId: record.offerSnapshotId,
      indexCurveId: record.indexCurveId,
      principal: '1000.123456789012345678901234567891',
      investmentDate: record.investmentDate,
      deletedAt: null,
    });
  });
});
