import { Prisma } from '@prisma/client';
import { SimulationMapper } from './simulation.mapper';

const record = {
  id: 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11',
  ownerId: 'owner-id',
  sourceOfferId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  titleType: 'CDB' as const,
  issuerId: null,
  maturityDate: new Date('2028-01-03T00:00:00.000Z'),
  redemptionType: 'DAILY' as const,
  remunerationType: 'CDI_PERCENTAGE' as const,
  rateValue: new Prisma.Decimal('1.123456789012345678901234567891'),
  deletedAt: new Date('2026-10-11T12:00:00.000Z'),
  createdAt: new Date('2026-10-10T12:00:00.000Z'),
  updatedAt: new Date('2026-10-10T12:00:00.000Z'),
};

describe('SimulationMapper', () => {
  it('round-trips every stored field, including terms without an issuer', () => {
    const simulation = SimulationMapper.toDomain(record);

    expect(simulation.terms.issuerId).toBeNull();
    expect(simulation.terms.maturityDate.toIsoString()).toBe('2028-01-03');
    expect(simulation.deletedAt?.toISOString()).toBe(
      '2026-10-11T12:00:00.000Z',
    );
    expect(SimulationMapper.toPersistence(simulation)).toEqual({
      id: record.id,
      ownerId: record.ownerId,
      sourceOfferId: record.sourceOfferId,
      titleType: 'CDB',
      issuerId: null,
      maturityDate: record.maturityDate,
      redemptionType: 'DAILY',
      remunerationType: 'CDI_PERCENTAGE',
      rateValue: '1.123456789012345678901234567891',
      deletedAt: record.deletedAt,
    });
  });
});
