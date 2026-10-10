import { UtcInstant } from '@investflow/shared-domain';
import { Simulation } from './simulation.aggregate';

const DELETED_AT = UtcInstant.ofIso('2026-10-10T12:00:00Z');

describe('Simulation', () => {
  it('creates independently identified simulations with their origin', () => {
    const fromOffer = Simulation.create({
      ownerId: 'owner-id',
      sourceOfferId: 'offer-id',
    });
    const typed = Simulation.create({ ownerId: 'owner-id', sourceOfferId: null });

    expect(fromOffer.id).not.toBe(typed.id);
    expect(fromOffer.ownerId).toBe('owner-id');
    expect(fromOffer.sourceOfferId).toBe('offer-id');
    expect(typed.sourceOfferId).toBeNull();
    expect(typed.deletedAt).toBeNull();
  });

  it('soft deletes idempotently and keeps the first instant', () => {
    const simulation = Simulation.create({
      ownerId: 'owner-id',
      sourceOfferId: null,
    });

    simulation.delete(DELETED_AT);
    simulation.delete(UtcInstant.ofIso('2026-10-11T12:00:00Z'));

    expect(simulation.deletedAt).toBe(DELETED_AT);
  });

  it('reconstitutes its identity and state', () => {
    const simulation = Simulation.reconstitute({
      id: 'simulation-id',
      ownerId: 'owner-id',
      sourceOfferId: 'offer-id',
      deletedAt: DELETED_AT,
    });

    expect(simulation.id).toBe('simulation-id');
    expect(simulation.sourceOfferId).toBe('offer-id');
    expect(simulation.deletedAt).toBe(DELETED_AT);
  });
});
