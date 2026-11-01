import {
  cdiCurve as cdi,
  cdiOffer,
  options,
  ownTermsWorkspace,
  remunerations,
  selicOffer,
  workspace,
} from '../../../testing/simulator-fixtures';
import type { RemunerationOption } from '../../models/simulation.types';
import { toOfferInput } from '../../../offers/utils/offer-form';
import {
  blankSimulationValues,
  startsBeforeCurve,
  defaultCurveId,
  offerTermValues,
  changesOfferTerms,
  duplicateValues,
  simulationFormSchema,
  simulationValues,
  toSimulationInput,
  offerFormValues,
  type SimulationFormValues,
} from '../simulation-form';

const offer = {
  ...selicOffer,
  issuerName: 'Banco Local',
  redemptionTerms: { kind: 'DAILY' as const },
  remunerationTerms: { kind: 'CDI_PERCENTAGE' as const, rate: '1.10' },
};

const valid: SimulationFormValues = {
  offerId: '',
  offerName: ' CDB digitado ',
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

const typedOffer = (values: SimulationFormValues) =>
  toOfferInput(offerFormValues(values));

function errors(values: SimulationFormValues) {
  const result = simulationFormSchema(remunerations).safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [issue.path[0], issue.message]),
      );
}

describe('simulation form', () => {
  it('accepts typed terms and builds the new offer payload', () => {
    expect(errors(valid)).toEqual({});
    expect(typedOffer(valid)).toEqual({
      titleType: 'CDB',
      name: 'CDB digitado',
      issuerName: 'Banco Local',
      maturityDate: '2026-03-02',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
    });
  });

  it('tells terms that differ from their offer, however they were typed', () => {
    const offer = { ...cdiOffer };
    const same = simulationValues(workspace, remunerations);

    expect(changesOfferTerms(offer, same)).toBe(false);
    expect(changesOfferTerms(offer, { ...same, rate: '105,0' })).toBe(false);
    expect(changesOfferTerms(offer, { ...same, rate: '110' })).toBe(true);
    // A rate not yet valid differs too.
    expect(changesOfferTerms(offer, { ...same, rate: 'abc' })).toBe(true);
    expect(changesOfferTerms(undefined, same)).toBe(true);
  });

  it('counts the title type as a term and never the apelido', () => {
    const same = simulationValues(workspace, remunerations);

    expect(changesOfferTerms(cdiOffer, { ...same, titleType: 'LCA' })).toBe(
      true,
    );
    expect(changesOfferTerms(cdiOffer, { ...same, offerName: 'Outro' })).toBe(
      false,
    );
  });

  it('sends only the id of an existing offer and no curve for a fixed rate', () => {
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
  });

  it('sends typed terms without an issuer', () => {
    expect(errors({ ...valid, issuerName: '  ' })).toEqual({});
    expect(typedOffer({ ...valid, issuerName: '  ' }).issuerName).toBeNull();
  });

  it('needs neither an offer nor a name for typed terms', () => {
    expect(errors({ ...valid, offerName: ' ' })).toEqual({});
    expect(typedOffer({ ...valid, offerName: ' ' }).name).toBeNull();
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

  it('starts blank simulations with today, no offer and a sole curve', () => {
    expect(blankSimulationValues('2026-10-10', options)).toMatchObject({
      offerId: '',
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
      simulationValues(
        {
          ...workspace,
          simulation: {
            ...workspace.simulation,
            investment: {
              ...workspace.simulation.investment,
              principal: '10000.5',
            },
          },
        },
        remunerations,
      ),
    ).toEqual({
      ...valid,
      offerId: 'cdi-offer',
      offerName: 'Reserva',
      principal: '10000,5',
      rate: '105',
    });
  });

  it('duplicates own terms based on their offer, never sharing them', () => {
    expect(duplicateValues(ownTermsWorkspace, remunerations)).toMatchObject({
      offerId: 'cdi-offer',
      rate: '110',
    });
    const deletedBase = {
      ...ownTermsWorkspace,
      offer: {
        ...ownTermsWorkspace.offer,
        basedOn: { ...workspace.offer, deleted: true },
      },
    };
    expect(duplicateValues(deletedBase, remunerations).offerId).toBe('');
  });

  it("replaces a saved curve the offer's index no longer takes", () => {
    const movedTo = (kind: 'PREFIXED' | 'SELIC_PERCENTAGE') =>
      simulationValues(
        {
          ...workspace,
          offer: {
            ...workspace.offer,
            remunerationTerms: { kind, rate: '1' },
          },
        },
        remunerations,
      ).curveId;
    // The form hides the curve of a prefixed offer, so it must not send one.
    expect(movedTo('PREFIXED')).toBe('');
    // The only curve of the new index is chosen, so saving fixes it.
    expect(movedTo('SELIC_PERCENTAGE')).toBe('selic');
  });

  it('keeps a deleted saved curve so the form names it as missing', () => {
    const values = simulationValues(
      {
        ...workspace,
        curve: { ...workspace.curve!, deleted: true },
        simulation: {
          ...workspace.simulation,
          investment: { ...workspace.simulation.investment, curveId: 'gone' },
        },
      },
      remunerations,
    );
    expect(values.curveId).toBe('gone');
  });

  it('fills terms from an offer', () => {
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
    expect(
      offerTermValues(offer, { curveId: 'selic' }, remunerations).curveId,
    ).toBe('cdi');
  });

  it('warns only when the investment date precedes the curve', () => {
    expect(startsBeforeCurve('2026-01-02', cdi)).toBe(false);
    // After the curve's end its last value holds.
    expect(startsBeforeCurve('2029-01-03', cdi)).toBe(false);
    expect(startsBeforeCurve('2025-12-31', cdi)).toBe(true);
    expect(startsBeforeCurve('', cdi)).toBe(false);
    expect(startsBeforeCurve('2025-12-31', undefined)).toBe(false);
  });
});
