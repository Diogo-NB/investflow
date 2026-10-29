import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
} from '@investflow/shared-domain';
import { Curve } from '../../curves/curve.aggregate';
import { Offer } from '../../offers/offer.aggregate';
import { ETitleType } from '../../offers/title-type.enum';
import { InvestmentInputs } from '../investment-inputs.vo';
import { SimulationResult } from '../simulation-result.vo';
import { Simulation } from '../simulation.aggregate';
import {
  CALCULATED_AT,
  calculationService,
  cause,
  cdiCurve,
  investment,
  offer,
} from './simulation-fixture';

// After the end of the fixture curve's values.
// A business day before the fixture curve's first start.
const UNCOVERED_INVESTMENT_DATE = '2025-12-31';

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
            investment({
              curveId: curve.id,
              investmentDate: UNCOVERED_INVESTMENT_DATE,
            }),
            offer('CDI_PERCENTAGE'),
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
      expect(outcome.simulationRevision).toBe(1);
      expect(
        outcome.result.inputFingerprint.equals(
          SimulationResult.inputFingerprintFor({
            simulationRevision: 1,
            offer: { titleType: ETitleType.CDB, termsRevision: 1 },
            curveValuesRevision: curve.valuesRevision,
          }),
        ),
      ).toBe(true);
      expect(outcome.result.calculatedAt).toBe(CALCULATED_AT);
      expect(
        outcome.result.projection.dailyBalances.at(-1)?.date.toIsoString(),
      ).toBe('2026-01-06');
    });

    it('returns a broken rule as an invalid outcome', () => {
      const outcome = calculate(offer('CDI_PERCENTAGE'));

      if (outcome.kind !== 'INVALID') throw new Error(outcome.kind);
      expect(outcome.simulationRevision).toBe(1);
      expect(outcome.reason.code).toBe(EAppErrorCode.INVESTMENT_CURVE_REQUIRED);
      expect(
        outcome.inputFingerprint.equals(
          SimulationResult.inputFingerprintFor({
            simulationRevision: 1,
            offer: { titleType: ETitleType.CDB, termsRevision: 1 },
            curveValuesRevision: null,
          }),
        ),
      ).toBe(true);
    });

    it('returns missing curve coverage as an invalid outcome', () => {
      const curve = cdiCurve();
      const chosen = offer('CDI_PERCENTAGE');

      const outcome = calculate(
        chosen,
        investment({
          curveId: curve.id,
          investmentDate: UNCOVERED_INVESTMENT_DATE,
        }),
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

  describe('isCurrent', () => {
    it('is not current while waiting for an outcome', () => {
      const chosen = offer();

      expect(
        calculationService.isCurrent(
          simulation(chosen, investment()),
          chosen,
          null,
        ),
      ).toBe(false);
    });

    it.each(['CALCULATED', 'INVALID'])(
      'is current once a %s outcome is recorded for the premises',
      (kind) => {
        const chosen = offer(
          kind === 'CALCULATED' ? 'PREFIXED' : 'CDI_PERCENTAGE',
        );
        const recorded = simulation(chosen, investment());
        recorded.recordCalculation(
          calculationService.calculate(recorded, chosen, null, CALCULATED_AT),
          CALCULATED_AT,
        );

        expect(calculationService.isCurrent(recorded, chosen, null)).toBe(true);
      },
    );

    it('is not current after the offer terms changed', () => {
      const chosen = offer();
      const recorded = simulation(chosen, investment());
      recorded.recordCalculation(
        calculationService.calculate(recorded, chosen, null, CALCULATED_AT),
        CALCULATED_AT,
      );

      chosen.markPersisted();
      chosen.edit(
        { maturityDate: CalendarDate.of('2026-01-07') },
        CALCULATED_AT,
      );

      expect(chosen.termsRevision).toBe(2);
      expect(calculationService.isCurrent(recorded, chosen, null)).toBe(false);
    });
  });
});
