import { SimulationMapper } from './simulation.mapper';

const record = {
  id: 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11',
  ownerId: 'owner-id',
  sourceOfferId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  deletedAt: new Date('2026-10-11T12:00:00.000Z'),
  createdAt: new Date('2026-10-10T12:00:00.000Z'),
  updatedAt: new Date('2026-10-10T12:00:00.000Z'),
};

describe('SimulationMapper', () => {
  it('round-trips every stored field', () => {
    const simulation = SimulationMapper.toDomain(record);

    expect(simulation.deletedAt?.toISOString()).toBe(
      '2026-10-11T12:00:00.000Z',
    );
    expect(SimulationMapper.toPersistence(simulation)).toEqual({
      id: record.id,
      ownerId: record.ownerId,
      sourceOfferId: record.sourceOfferId,
      deletedAt: record.deletedAt,
    });
  });
});
