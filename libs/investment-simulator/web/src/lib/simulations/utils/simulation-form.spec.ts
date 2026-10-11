import {
  cdiCurve as cdi,
  options,
  remunerations,
  selicOffer,
  workspace,
} from '../../testing/simulator-fixtures';
import type { RemunerationOption } from '../models/simulation.types';
import {
  blankSimulationValues,
  coverageGap,
  defaultCurveId,
  differsFromOffer,
  offerTermValues,
  simulationFormSchema,
  simulationValues,
  toSimulationInput,
  type SimulationFormValues,
} from './simulation-form';

const offer = {
  ...selicOffer,
  issuerName: 'Banco Local',
  redemptionTerms: { kind: 'DAILY' as const },
  remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate: '1.10' },
};

const valid: SimulationFormValues = {
  offerId: '',
  principal: '10.000,50',
  investmentDate: '2026-01-02',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationKind: 'CDI_PERCENTAGE',
  rate: '110',
  maturityDate: '2026-03-02',
  redemptionKind: 'DAILY',
  curveId: 'cdi',
};

function errors(values: SimulationFormValues) {
  const result = simulationFormSchema(remunerations).safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [issue.path[0], issue.message]),
      );
}

describe('simulation form', () => {
  it('accepts complete terms and builds the exact API payload', () => {
    expect(errors(valid)).toEqual({});
    expect(toSimulationInput(valid)).toEqual({
      terms: {
        titleType: 'CDB',
        issuerName: 'Banco Local',
        maturityDate: '2026-03-02',
        redemptionTerms: { kind: 'DAILY' },
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      },
      investment: {
        principal: '10000.5',
        investmentDate: '2026-01-02',
        curveId: 'cdi',
      },
    });
  });

  it('sends the catalog offer and no curve for a fixed rate', () => {
    // The form clears the curve whenever the kind changes.
    const input = toSimulationInput({
      ...valid,
      offerId: 'offer',
      remunerationKind: 'PREFIXED',
      rate: '12,5',
      curveId: '',
    });
    expect(input.offerId).toBe('offer');
    expect(input.investment.curveId).toBeNull();
    expect(input.terms.remunerationTerms).toEqual({
      kind: 'PREFIXED',
      rate: '0.125',
    });
  });

  it('sends the chosen title type', () => {
    expect(
      toSimulationInput({ ...valid, titleType: 'LCA' }).terms.titleType,
    ).toBe('LCA');
  });

  it('sends terms without an issuer', () => {
    expect(errors({ ...valid, issuerName: '  ' })).toEqual({});
    expect(
      toSimulationInput({ ...valid, issuerName: '  ' }).terms.issuerName,
    ).toBeNull();
  });

  it('sends the trimmed issuer name', () => {
    expect(
      toSimulationInput({ ...valid, issuerName: ' Banco Local ' }).terms
        .issuerName,
    ).toBe('Banco Local');
  });

  it('explains every invalid input in Portuguese', () => {
    expect(
      errors({
        ...valid,
        principal: '0',
        rate: 'abc',
        investmentDate: '31/02/2026',
        maturityDate: '',
        curveId: '',
      }),
    ).toEqual({
      principal: 'O valor aplicado deve ser maior que zero.',
      rate: 'Use apenas números, como 10.000,50.',
      investmentDate: 'Informe uma data válida no formato DD/MM/AAAA.',
      maturityDate: 'Informe a data.',
      curveId: 'Escolha a curva do índice.',
    });
    expect(errors({ ...valid, maturityDate: '2026-01-02' })).toEqual({
      maturityDate: 'O vencimento deve ser depois da data da aplicação.',
    });
    expect(errors({ ...valid, rate: `1,${'1'.repeat(29)}` })).toEqual({
      rate: 'Taxa com casas decimais demais.',
    });
  });

  it('starts blank simulations with today, no issuer and a sole curve', () => {
    expect(blankSimulationValues('2026-10-10', options)).toMatchObject({
      investmentDate: '2026-10-10',
      titleType: 'CDB',
      issuerName: '',
      remunerationKind: 'CDI_PERCENTAGE',
      redemptionKind: 'AT_MATURITY',
      curveId: 'cdi',
    });
    const twoCurves: RemunerationOption[] = [
      { ...remunerations[1], curves: [cdi, { ...cdi, id: 'cdi-2' }] },
    ];
    expect(defaultCurveId('CDI_PERCENTAGE', twoCurves)).toBe('');
    expect(defaultCurveId('PREFIXED', remunerations)).toBe('');
  });

  it('edits saved simulations in the units the user typed', () => {
    expect(
      simulationValues(workspace.simulation.terms, {
        ...workspace.calculations[0].investment,
        principal: '10000.5',
      }),
    ).toEqual({ ...valid, principal: '10000,5', rate: '105' });
  });

  it('fills terms from an offer and tracks later edits', () => {
    const filled = {
      ...valid,
      ...offerTermValues(offer, { curveId: '' }, remunerations),
    };
    expect(filled).toMatchObject({
      titleType: 'CDB',
      issuerName: 'Banco Local',
      rate: '110',
      maturityDate: '2028-12-29',
      curveId: 'cdi',
    });
    expect(differsFromOffer(filled, offer)).toBe(false);
    expect(differsFromOffer({ ...filled, rate: '115' }, offer)).toBe(true);
    expect(differsFromOffer({ ...filled, titleType: 'LCI' }, offer)).toBe(true);
    expect(
      offerTermValues(offer, { curveId: 'selic' }, remunerations).curveId,
    ).toBe('cdi');
  });

  it('warns when the curve does not span the rate references', () => {
    expect(
      coverageGap(
        { investmentDate: '2026-01-02', maturityDate: '2029-01-01' },
        cdi,
      ),
    ).toBeNull();
    expect(
      coverageGap(
        { investmentDate: '2026-01-02', maturityDate: '2029-01-03' },
        cdi,
      ),
    ).toEqual(cdi.coverage);
    expect(
      coverageGap(
        { investmentDate: '2025-12-31', maturityDate: '2026-06-01' },
        cdi,
      ),
    ).toEqual(cdi.coverage);
    expect(
      coverageGap({ investmentDate: '', maturityDate: '' }, cdi),
    ).toBeNull();
  });
});
