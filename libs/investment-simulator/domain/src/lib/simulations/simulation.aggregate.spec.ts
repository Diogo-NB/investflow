import {
  DomainError,
  EAppErrorCode,
  Money,
  UtcInstant,
} from '@investflow/shared-domain';
import { Curve } from '../curves/curve.aggregate';
import { Offer } from '../offers/offer.aggregate';
import { InvestmentInputs } from './investment-inputs.vo';
import { Simulation } from './simulation.aggregate';
import {
  CALCULATED_AT,
  calculator,
  cdiCurve,
  investment,
  offer,
} from './simulation-fixture';

const LATER = UtcInstant.ofIso('2026-10-11T12:00:00Z');

function create(
  options: { offer?: Offer; investment?: InvestmentInputs; curve?: Curve } = {},
) {
  return Simulation.create({
    ownerId: 'owner-id',
    offer: options.offer ?? offer(),
    investment: options.investment ?? investment(),
    curve: options.curve ?? null,
    calculator,
    calculatedAt: CALCULATED_AT,
  });
}

function edit(
  simulation: Simulation,
  options: { offer?: Offer; investment?: InvestmentInputs } = {},
) {
  return simulation.edit({
    offer: options.offer ?? offer(),
    investment: options.investment ?? simulation.investment,
    curve: null,
    calculator,
    calculatedAt: LATER,
  });
}

describe('Simulation', () => {
  it('is created at revision 1 with the result of its premises', () => {
    const chosen = offer();

    const simulation = create({ offer: chosen }).value;

    expect(simulation.ownerId).toBe('owner-id');
    expect(simulation.offerId).toBe(chosen.id);
    expect(simulation.investment.equals(investment())).toBe(true);
    expect(simulation.revision).toBe(1);
    expect(simulation.deletedAt).toBeNull();
    expect(simulation.result?.inputs).toEqual({
      simulationRevision: 1,
      offerRevision: 1,
      curveRevision: null,
      methodologyVersion: 'cdb-252-v1',
    });
    expect(simulation.result?.calculatedAt).toBe(CALCULATED_AT);
    expect(
      simulation.result?.calculation.dailyBalances.at(-1)?.date.toIsoString(),
    ).toBe('2026-01-06');
  });

  it('is not created when its calculation is rejected', () => {
    expect(
      create({ investment: investment({ principal: Money.of('0') }) }).error
        .code,
    ).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(
      create({ investment: investment({ investmentDate: '2026-01-03' }) }).error
        .code,
    ).toBe(EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY);
  });

  it('records the curve revision for indexed remuneration', () => {
    const curve = cdiCurve();

    const simulation = create({
      offer: offer('CDI_PERCENTAGE'),
      investment: investment({ curveId: curve.id }),
      curve,
    }).value;

    expect(simulation.result?.inputs.curveRevision).toBe(curve.revision);
    expect(create({ offer: offer('CDI_PERCENTAGE') }).error.code).toBe(
      EAppErrorCode.INVESTMENT_CURVE_REQUIRED,
    );
  });

  it('refuses a curve other than the referenced one', () => {
    expect(() =>
      create({
        offer: offer('CDI_PERCENTAGE'),
        investment: investment({ curveId: 'other-curve' }),
        curve: cdiCurve(),
      }),
    ).toThrow(DomainError);
  });

  it('increments its revision when the offer or investment changes', () => {
    const simulation = create().value;
    const other = offer();

    edit(simulation, { offer: other });
    expect(simulation.offerId).toBe(other.id);
    expect(simulation.revision).toBe(2);

    edit(simulation, {
      offer: other,
      investment: investment({ principal: Money.of('2000') }),
    });
    expect(simulation.revision).toBe(3);
    expect(simulation.result?.inputs.simulationRevision).toBe(3);
    expect(
      simulation.result?.calculation.maturitySummary.principal.equals(
        Money.of('2000'),
      ),
    ).toBe(true);
  });

  it('recalculates without a new revision when nothing changed', () => {
    const chosen = offer();
    const simulation = create({ offer: chosen }).value;
    chosen.edit({ name: 'Renomeada' }, LATER);

    edit(simulation, { offer: chosen });

    expect(simulation.revision).toBe(1);
    expect(simulation.result?.inputs.offerRevision).toBe(2);
    expect(simulation.result?.calculatedAt).toBe(LATER);
  });

  it('keeps its state when an edit is rejected', () => {
    const simulation = create().value;
    const before = simulation.result;

    const edited = edit(simulation, {
      investment: investment({ principal: Money.of('0') }),
    });

    expect(edited.error.code).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(simulation.revision).toBe(1);
    expect(simulation.result).toBe(before);
  });

  it('reports a stale revision as a conflict', () => {
    const simulation = create().value;

    expect(simulation.assertRevision(1).isOk()).toBe(true);
    expect(simulation.assertRevision(2).error.code).toBe(
      EAppErrorCode.SIMULATION_REVISION_CONFLICT,
    );
  });

  it('rejects edits once deleted', () => {
    const simulation = create().value;
    simulation.delete(CALCULATED_AT);

    expect(edit(simulation).error.code).toBe(EAppErrorCode.SIMULATION_DELETED);
  });

  it('soft deletes idempotently and keeps the first instant', () => {
    const simulation = create().value;

    simulation.delete(CALCULATED_AT);
    simulation.delete(LATER);

    expect(simulation.deletedAt).toBe(CALCULATED_AT);
    expect(simulation.revision).toBe(2);
  });

  it('reconstitutes its identity and state', () => {
    const simulation = Simulation.reconstitute({
      id: 'simulation-id',
      ownerId: 'owner-id',
      offerId: 'offer-id',
      investment: investment(),
      revision: 4,
      result: null,
      deletedAt: CALCULATED_AT,
    });

    expect(simulation.id).toBe('simulation-id');
    expect(simulation.revision).toBe(4);
    expect(simulation.result).toBeNull();
    expect(simulation.deletedAt).toBe(CALCULATED_AT);
  });
});
