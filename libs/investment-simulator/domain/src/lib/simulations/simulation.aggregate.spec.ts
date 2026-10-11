import {
  DomainError,
  EAppErrorCode,
  Money,
  UtcInstant,
} from '@investflow/shared-domain';
import { RemunerationKind } from '../offers/terms/remuneration/remuneration-terms.vo';
import { Simulation } from './simulation.aggregate';
import {
  CALCULATED_AT,
  calculator,
  cdiCurve,
  investment,
  terms,
} from './simulation-fixture';
import { InvestmentInputs } from './investment-inputs.vo';

function start(
  options: {
    kind?: RemunerationKind;
    investment?: InvestmentInputs;
    sourceOfferId?: string | null;
  } = {},
) {
  return Simulation.start({
    ownerId: 'owner-id',
    sourceOfferId: options.sourceOfferId ?? null,
    terms: terms(options.kind),
    investment: options.investment ?? investment(),
    indexCurve: null,
    calculator,
    calculatedAt: CALCULATED_AT,
  });
}

describe('Simulation', () => {
  it('starts with its terms, origin and first calculation', () => {
    const { simulation, calculation } = start({
      sourceOfferId: 'offer-id',
    }).value;

    expect(simulation.ownerId).toBe('owner-id');
    expect(simulation.sourceOfferId).toBe('offer-id');
    expect(simulation.terms.equals(terms())).toBe(true);
    expect(simulation.deletedAt).toBeNull();
    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.investment.equals(investment())).toBe(true);
    expect(calculation.calculatedAt).toBe(CALCULATED_AT);
    expect(calculation.result.dailyBalances.at(-1)?.date.toIsoString()).toBe(
      '2026-01-06',
    );
  });

  it('does not start when the first calculation is rejected', () => {
    expect(
      start({ investment: investment({ principal: Money.of('0') }) }).error
        .code,
    ).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(
      start({ investment: investment({ investmentDate: '2026-01-03' }) }).error
        .code,
    ).toBe(EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY);
  });

  it('calculates other investments under the same terms', () => {
    const { simulation } = start().value;

    const calculation = simulation.calculate({
      investment: investment({ principal: Money.of('2000') }),
      indexCurve: null,
      calculator,
      calculatedAt: CALCULATED_AT,
    }).value;

    expect(calculation.simulationId).toBe(simulation.id);
    expect(calculation.investment.principal.equals(Money.of('2000'))).toBe(
      true,
    );
  });

  it('uses the referenced curve for indexed terms', () => {
    const curve = cdiCurve();

    const started = Simulation.start({
      ownerId: 'owner-id',
      sourceOfferId: null,
      terms: terms('CDI_PERCENTAGE'),
      investment: investment({ indexCurveId: curve.id }),
      indexCurve: curve,
      calculator,
      calculatedAt: CALCULATED_AT,
    });

    expect(started.value.calculation.investment.indexCurveId).toBe(curve.id);
    expect(start({ kind: 'CDI_PERCENTAGE' }).error.code).toBe(
      EAppErrorCode.INVESTMENT_CURVE_REQUIRED,
    );
  });

  it('refuses a curve other than the referenced one', () => {
    const { simulation } = start().value;

    expect(() =>
      simulation.calculate({
        investment: investment({ indexCurveId: 'other-curve' }),
        indexCurve: cdiCurve(),
        calculator,
        calculatedAt: CALCULATED_AT,
      }),
    ).toThrow(DomainError);
  });

  it('rejects calculating once deleted', () => {
    const { simulation } = start().value;
    simulation.delete(CALCULATED_AT);

    const calculated = simulation.calculate({
      investment: investment(),
      indexCurve: null,
      calculator,
      calculatedAt: CALCULATED_AT,
    });

    expect(calculated.error.code).toBe(EAppErrorCode.SIMULATION_DELETED);
  });

  it('soft deletes idempotently and keeps the first instant', () => {
    const { simulation } = start().value;

    simulation.delete(CALCULATED_AT);
    simulation.delete(UtcInstant.ofIso('2026-10-11T12:00:00Z'));

    expect(simulation.deletedAt).toBe(CALCULATED_AT);
  });

  it('reconstitutes its identity, terms and state', () => {
    const simulation = Simulation.reconstitute({
      id: 'simulation-id',
      ownerId: 'owner-id',
      sourceOfferId: null,
      terms: terms('PREFIXED', null),
      deletedAt: CALCULATED_AT,
    });

    expect(simulation.id).toBe('simulation-id');
    expect(simulation.terms.issuerName).toBeNull();
    expect(simulation.deletedAt).toBe(CALCULATED_AT);
  });
});
