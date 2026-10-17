import { DomainError, EAppErrorCode, Money } from '@investflow/shared-domain';
import { Curve } from '../curves/curve.aggregate';
import { Offer } from '../offers/offer.aggregate';
import { InvestmentInputs } from './investment-inputs.vo';
import { Simulation } from './simulation.aggregate';
import {
  CALCULATED_AT,
  calculationService,
  cause,
  cdiCurve,
  investment,
  offer,
} from './simulation-fixture';

// After the end of the fixture curve's values.
const UNCOVERED_MATURITY = '2026-03-06';

function simulation(chosen: Offer, inputs: InvestmentInputs): Simulation {
  return Simulation.create(
    { ownerId: 'owner-id', offerId: chosen.id, investment: inputs },
    cause(),
    CALCULATED_AT,
  );
}

function calculate(
  chosen: Offer,
  inputs: InvestmentInputs = investment(),
  curve: Curve | null = null,
) {
  return calculationService.calculate(
    simulation(chosen, inputs),
    chosen,
    curve,
    CALCULATED_AT,
  );
}

describe('SimulationCalculationService', () => {
  describe('validate', () => {
    it('accepts a calculable scenario', () => {
      expect(
        calculationService.validate(investment(), offer(), null).isOk(),
      ).toBe(true);
    });

    it('rejects scenario and calculator rules', () => {
      expect(
        calculationService.validate(
          investment({ principal: Money.of('0') }),
          offer(),
          null,
        ).error.code,
      ).toBe(EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID);
      expect(
        calculationService.validate(
          investment({ investmentDate: '2026-01-03' }),
          offer(),
          null,
        ).error.code,
      ).toBe(EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY);
      expect(
        calculationService.validate(investment(), offer('CDI_PERCENTAGE'), null)
          .error.code,
      ).toBe(EAppErrorCode.INVESTMENT_CURVE_REQUIRED);
    });

    it('does not check curve coverage', () => {
      const curve = cdiCurve();

      expect(
        calculationService
          .validate(
            investment({ curveId: curve.id, investmentDate: '2026-01-02' }),
            offer('CDI_PERCENTAGE', null, UNCOVERED_MATURITY),
            curve,
          )
          .isOk(),
      ).toBe(true);
    });
  });

  describe('calculate', () => {
    it('returns the result of the premises with their revisions', () => {
      const curve = cdiCurve();
      const outcome = calculate(
        offer('CDI_PERCENTAGE'),
        investment({ curveId: curve.id }),
        curve,
      );

      if (outcome.kind !== 'CALCULATED') throw new Error(outcome.kind);
      expect(outcome.result.inputs).toEqual({
        simulationRevision: 1,
        offerRevision: 1,
        curveRevision: curve.revision,
        methodologyVersion: 'cdb-252-v1',
      });
      expect(outcome.result.calculatedAt).toBe(CALCULATED_AT);
      expect(
        outcome.result.projection.dailyBalances.at(-1)?.date.toIsoString(),
      ).toBe('2026-01-06');
    });

    it('returns a broken rule as an invalid outcome', () => {
      const outcome = calculate(offer('CDI_PERCENTAGE'));

      expect(outcome).toMatchObject({
        kind: 'INVALID',
        inputs: {
          simulationRevision: 1,
          offerRevision: 1,
          curveRevision: null,
        },
        reason: { code: EAppErrorCode.INVESTMENT_CURVE_REQUIRED },
      });
    });

    it('returns missing curve coverage as an invalid outcome', () => {
      const curve = cdiCurve();
      const chosen = offer('CDI_PERCENTAGE', null, UNCOVERED_MATURITY);

      const outcome = calculate(
        chosen,
        investment({ curveId: curve.id }),
        curve,
      );

      expect(outcome.kind === 'INVALID' && outcome.reason.code).toBe(
        EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
      );
    });

    it('refuses a curve other than the referenced one', () => {
      expect(() =>
        calculate(
          offer('CDI_PERCENTAGE'),
          investment({ curveId: 'other-curve' }),
          cdiCurve(),
        ),
      ).toThrow(DomainError);
    });
  });
});
