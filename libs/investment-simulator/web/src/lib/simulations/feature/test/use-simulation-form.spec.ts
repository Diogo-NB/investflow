import { act, renderHook } from '@testing-library/react';
import {
  cdiOffer,
  options,
  remunerations,
  selicCurve,
  selicOffer,
} from '../../../testing/simulator-fixtures';
import type { SimulationFormValues } from '../../utils/simulation-form';
import { useSimulationForm } from '../use-simulation-form';

const initialValues: SimulationFormValues = {
  offerId: 'cdi-offer',
  offerName: 'Reserva',
  principal: '10.000',
  investmentDate: '2026-01-02',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationKind: 'CDI_PERCENTAGE',
  rate: '105',
  maturityDate: '2026-03-02',
  redemptionKind: 'DAILY',
  curveId: 'cdi',
};

function render(
  overrides: Partial<Parameters<typeof useSimulationForm>[0]> = {},
) {
  return renderHook(() =>
    useSimulationForm({
      initialValues,
      offers: options.offers,
      remunerations,
      ...overrides,
    }),
  );
}

describe('useSimulationForm', () => {
  it('restarts the rate and curve when the remuneration kind changes', () => {
    const { result } = render();
    // React Hook Form tracks dirtiness once it is read, as the editor does.
    expect(result.current.form.formState.isDirty).toBe(false);

    act(() => result.current.changeKind('SELIC_PERCENTAGE'));

    expect(result.current.values).toMatchObject({
      remunerationKind: 'SELIC_PERCENTAGE',
      rate: '',
      curveId: 'selic',
    });
    expect(result.current.curveOptions).toEqual([selicCurve]);
    expect(result.current.index).toBe('SELIC');
    expect(result.current.form.formState.isDirty).toBe(true);

    act(() => result.current.changeKind('PREFIXED'));
    expect(result.current.values.curveId).toBe('');
    expect(result.current.curveOptions).toEqual([]);
    expect(result.current.index).toBeNull();
  });

  it('mirrors the chosen offer and keeps the investment', () => {
    const { result } = render();
    expect(result.current.offer).toBe(cdiOffer);

    act(() => result.current.chooseOffer(selicOffer));

    expect(result.current.offer).toBe(selicOffer);
    expect(result.current.values).toMatchObject({
      offerId: 'offer',
      offerName: '',
      principal: '10.000',
      issuerName: 'Outro',
      remunerationKind: 'SELIC_PERCENTAGE',
      rate: '100',
      maturityDate: '2028-12-29',
      redemptionKind: 'AT_MATURITY',
      curveId: 'selic',
    });
  });

  it('compares the terms with the offer they came from', () => {
    const { result } = render();
    expect(result.current.termsChanged).toBe(false);
    expect(result.current.isOwnTerms).toBe(false);

    act(() => result.current.form.setValue('rate', '110'));
    expect(result.current.termsChanged).toBe(true);

    // Only the investment changed: the terms still follow the offer.
    act(() => result.current.form.setValue('rate', '105'));
    act(() => result.current.form.setValue('principal', '20.000'));
    expect(result.current.termsChanged).toBe(false);
  });

  it('treats terms typed without an offer as changed', () => {
    const { result } = render({
      initialValues: { ...initialValues, offerId: '' },
    });

    expect(result.current.offer).toBeUndefined();
    expect(result.current.termsChanged).toBe(true);
  });

  it("recognizes the simulation's own terms until another offer is chosen", () => {
    const own = { ...cdiOffer, id: 'own-terms', origin: 'OWN' as const };
    const { result } = render({
      initialValues: { ...initialValues, offerId: 'own-terms' },
      ownTermsOffer: own,
    });

    expect(result.current.isOwnTerms).toBe(true);
    expect(result.current.offer).toBe(own);
    expect(result.current.termsChanged).toBe(false);

    act(() => result.current.chooseOffer(selicOffer));
    expect(result.current.isOwnTerms).toBe(false);
    expect(result.current.offer).toBe(selicOffer);
  });

  it('reports no chosen offer when the saved one is no longer listed', () => {
    const { result } = render({ offers: [selicOffer] });

    expect(result.current.offer).toBeUndefined();
  });

  it('warns when the investment date precedes the chosen curve', () => {
    const { result } = render();
    expect(result.current.startsBeforeCurve).toBe(false);

    // After the curve's end its last value holds.
    act(() => result.current.form.setValue('maturityDate', '2029-06-01'));
    expect(result.current.startsBeforeCurve).toBe(false);

    act(() => result.current.form.setValue('investmentDate', '2025-12-31'));
    expect(result.current.startsBeforeCurve).toBe(true);
  });

  it('shows rejections on their field', () => {
    const { result } = render();
    // Read once, as the form panel does, so React Hook Form tracks errors.
    expect(result.current.form.formState.errors).toEqual({});

    act(() =>
      result.current.showProblem({
        field: 'curveId',
        message: 'Curva excluída.',
        conflict: false,
      }),
    );
    expect(result.current.form.formState.errors.curveId?.message).toBe(
      'Curva excluída.',
    );
  });
});
