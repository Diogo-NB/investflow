import { EAppErrorCode, UtcInstant } from '@investflow/shared-domain';
import { InvestmentPlan } from '../investment-plan.aggregate';

const NOW = UtcInstant.ofIso('2026-10-27T12:00:00Z');

const savedPlanProps = {
  id: 'plan-1',
  ownerId: 'user-1',
  name: 'Reserva',
  description: null,
  simulationIds: [],
  deletedAt: null,
  revision: 3,
};

function savedPlan(simulationIds: readonly string[] = []) {
  return InvestmentPlan.reconstitute({ ...savedPlanProps, simulationIds });
}

const ids = (count: number, prefix = 'simulation') =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i}`);

describe('InvestmentPlan', () => {
  describe('create', () => {
    it('trims the name and keeps a blank description as none', () => {
      const plan = InvestmentPlan.create({
        ownerId: 'user-1',
        name: '  Reserva  ',
        description: '   ',
      }).value;

      expect(plan.name).toBe('Reserva');
      expect(plan.description).toBeNull();
      expect(plan.simulationIds).toEqual([]);
      expect(plan.revision).toBe(1);
    });

    it('requires a name', () => {
      const result = InvestmentPlan.create({ ownerId: 'user-1', name: '  ' });

      expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_INVALID);
    });
  });

  describe('assertRevision', () => {
    it('reports a conflict for another revision', () => {
      const plan = savedPlan();

      expect(plan.assertRevision(3).isOk()).toBe(true);
      const conflict = plan.assertRevision(2).error;
      expect(conflict.code).toBe(
        EAppErrorCode.INVESTMENT_PLAN_REVISION_CONFLICT,
      );
      expect(conflict.kind).toBe('conflict');
    });
  });

  describe('editDetails', () => {
    it('changes the name and description in one revision', () => {
      const plan = savedPlan();

      plan.editDetails({ name: ' Aposentadoria ' });
      plan.editDetails({ description: 'Longo prazo' });

      expect(plan.name).toBe('Aposentadoria');
      expect(plan.description).toBe('Longo prazo');
      expect(plan.revision).toBe(4);
    });

    it('clears the description with null and keeps it when omitted', () => {
      const plan = InvestmentPlan.reconstitute({
        ...savedPlanProps,
        description: 'Curto prazo',
      });

      plan.editDetails({ name: 'Reserva' });
      expect(plan.description).toBe('Curto prazo');
      plan.editDetails({ description: null });
      expect(plan.description).toBeNull();
    });

    it('keeps the revision when nothing changes', () => {
      const plan = savedPlan();

      expect(plan.editDetails({ name: ' Reserva ' }).isOk()).toBe(true);

      expect(plan.revision).toBe(3);
    });

    it('rejects a blank name without changing the plan', () => {
      const plan = savedPlan();

      const result = plan.editDetails({ name: ' ' });

      expect(result.error.code).toBe(EAppErrorCode.INVESTMENT_PLAN_INVALID);
      expect(plan.name).toBe('Reserva');
      expect(plan.revision).toBe(3);
    });
  });

  describe('addSimulations', () => {
    it('adds new ids once, in one revision', () => {
      const plan = savedPlan(['a']);

      plan.addSimulations(['a', 'b', 'c', 'b']);

      expect(plan.simulationIds).toEqual(['a', 'b', 'c']);
      expect(plan.revision).toBe(4);
    });

    it('keeps the revision when every id is already in the plan', () => {
      const plan = savedPlan(['a', 'b']);

      expect(plan.addSimulations(['b', 'a']).isOk()).toBe(true);

      expect(plan.revision).toBe(3);
    });

    it('fills the plan up to its limit', () => {
      const plan = savedPlan(ids(49));

      expect(plan.addSimulations(['last']).isOk()).toBe(true);

      expect(plan.simulationIds).toHaveLength(InvestmentPlan.SIMULATION_LIMIT);
    });

    it('rejects passing the limit without adding any', () => {
      const plan = savedPlan(ids(48));

      const result = plan.addSimulations(ids(3, 'new'));

      expect(result.error.code).toBe(
        EAppErrorCode.INVESTMENT_PLAN_SIMULATION_LIMIT,
      );
      expect(result.error.metadata).toMatchObject({
        limit: 50,
        availableSlots: 2,
      });
      expect(plan.simulationIds).toHaveLength(48);
      expect(plan.revision).toBe(3);
    });

    it('still accepts members already in a full plan', () => {
      const plan = savedPlan(ids(50));

      expect(plan.addSimulations(['simulation-0']).isOk()).toBe(true);
      expect(plan.addSimulations(['simulation-51']).error.code).toBe(
        EAppErrorCode.INVESTMENT_PLAN_SIMULATION_LIMIT,
      );
    });
  });

  describe('removeSimulation', () => {
    it('removes a member in a new revision', () => {
      const plan = savedPlan(['a', 'b']);

      plan.removeSimulation('a');

      expect(plan.simulationIds).toEqual(['b']);
      expect(plan.revision).toBe(4);
    });

    it('changes nothing for a simulation outside the plan', () => {
      const plan = savedPlan(['a']);

      plan.removeSimulation('b');

      expect(plan.simulationIds).toEqual(['a']);
      expect(plan.revision).toBe(3);
    });
  });

  describe('delete', () => {
    it('records when it was deleted, once', () => {
      const plan = savedPlan(['a']);

      plan.delete(NOW);
      plan.delete(UtcInstant.ofIso('2026-10-28T12:00:00Z'));

      expect(plan.deletedAt).toBe(NOW);
      expect(plan.revision).toBe(4);
      expect(plan.simulationIds).toEqual(['a']);
    });
  });
});
