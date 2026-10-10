import { DomainError, EAppErrorCode, Money } from '@investflow/shared-domain';
import { cdiCurve, simulationInputs } from './simulation-fixture';

describe('SimulationInputs', () => {
  it('builds a fixed-rate scenario without a curve', () => {
    const inputs = simulationInputs();
    const scenario = inputs.toScenario(null).value;

    expect(scenario.principal).toBe(inputs.principal);
    expect(scenario.investmentDate).toBe(inputs.investmentDate);
    expect(scenario.maturityDate).toBe(inputs.terms.maturityDate);
    expect(scenario.remuneration).toBe(inputs.terms.remuneration);
    expect(scenario.indexCurve).toBeNull();
  });

  it('builds an indexed scenario with its own curve', () => {
    const curve = cdiCurve();
    const scenario = simulationInputs('CDI_PERCENTAGE', {
      indexCurveId: curve.id,
    }).toScenario(curve).value;

    expect(scenario.indexCurve).toBe(curve);
  });

  it('returns the scenario rule a calculation would break', () => {
    expect(
      simulationInputs('PREFIXED', { principal: Money.of('0') }).toScenario(
        null,
      ).error.code,
    ).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
    expect(
      simulationInputs('CDI_PERCENTAGE').toScenario(null).error.code,
    ).toBe(EAppErrorCode.INVESTMENT_CURVE_REQUIRED);
  });

  it('refuses a curve other than the referenced one', () => {
    const inputs = simulationInputs('CDI_PERCENTAGE', {
      indexCurveId: 'other-curve',
    });

    expect(() => inputs.toScenario(cdiCurve())).toThrow(DomainError);
    expect(() => inputs.toScenario(null)).toThrow(DomainError);
  });

  it('compares by value', () => {
    expect(simulationInputs().equals(simulationInputs())).toBe(true);
    expect(
      simulationInputs().equals(
        simulationInputs('PREFIXED', { principal: Money.of('1000.00') }),
      ),
    ).toBe(true);
    expect(
      simulationInputs().equals(
        simulationInputs('PREFIXED', { principal: Money.of('1001') }),
      ),
    ).toBe(false);
  });
});
