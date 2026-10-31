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
  offerMode: 'existing',
  copiedOfferId: '',
  offerId: 'cdi-offer',
  offerName: '',
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
      offerMode: 'existing',
      offerId: 'offer',
      principal: '10.000',
      issuerName: 'Outro',
      remunerationKind: 'SELIC_PERCENTAGE',
      rate: '100',
      maturityDate: '2028-12-29',
      redemptionKind: 'AT_MATURITY',
      curveId: 'selic',
    });
  });

  it('duplicates the chosen offer into editable terms and goes back to it', () => {
    const { result } = render();

    act(() => result.current.duplicateOffer());
    expect(result.current.values).toMatchObject({
      offerMode: 'new',
      offerId: 'cdi-offer',
      copiedOfferId: 'cdi-offer',
      offerName: 'Reserva (cópia)',
      rate: '105',
      maturityDate: '2026-03-02',
    });

    act(() => result.current.form.setValue('rate', '110'));
    act(() => result.current.backToChosenOffer());
    expect(result.current.values).toMatchObject({
      offerMode: 'existing',
      offerId: 'cdi-offer',
      rate: '105',
    });
  });

  it('starts a new offer from blank, keeping the investment and a valid curve', () => {
    const { result } = render();

    act(() => result.current.newOffer());

    expect(result.current.values).toMatchObject({
      offerMode: 'new',
      offerName: '',
      titleType: 'CDB',
      issuerName: '',
      remunerationKind: 'CDI_PERCENTAGE',
      rate: '',
      maturityDate: '',
      principal: '10.000',
      curveId: 'cdi',
    });
  });

  it('edits the chosen own offer in place against the terms it started from', () => {
    const { result } = render();
    expect(result.current.form.formState.isDirty).toBe(false);

    act(() => result.current.editOffer());
    expect(result.current.values).toMatchObject({
      offerMode: 'editing',
      offerId: 'cdi-offer',
      offerName: 'Reserva',
      rate: '105',
    });
    expect(result.current.editedOffer).toBe(cdiOffer);
    expect(result.current.recalculatesOtherSimulations).toBe(false);
    expect(result.current.form.formState.isDirty).toBe(false);

    // Only terms a calculation reads recalculate the other simulations.
    act(() => result.current.form.setValue('offerName', 'Reserva nova'));
    expect(result.current.recalculatesOtherSimulations).toBe(false);
    act(() => result.current.form.setValue('rate', '110'));
    expect(result.current.recalculatesOtherSimulations).toBe(true);
    expect(result.current.changesIndex).toBe(false);

    act(() => result.current.changeKind('SELIC_PERCENTAGE'));
    expect(result.current.changesIndex).toBe(true);
    expect(result.current.values.curveId).toBe('selic');
  });

  it('discards an offer edit, keeping the investment', () => {
    const { result } = render();
    expect(result.current.form.formState.isDirty).toBe(false);

    act(() => result.current.editOffer());
    act(() => result.current.form.setValue('rate', '110'));
    act(() => result.current.form.setValue('principal', '20.000'));
    act(() => result.current.discardOfferEdits());

    expect(result.current.values).toMatchObject({
      offerMode: 'existing',
      offerName: '',
      rate: '105',
      principal: '20.000',
    });
    expect(result.current.editedOffer).toBeNull();
  });

  it('turns an offer edit into a copy with what was typed', () => {
    const { result } = render();

    act(() => result.current.editOffer());
    act(() => result.current.form.setValue('rate', '110'));
    act(() => result.current.saveAsNewOffer());

    expect(result.current.values).toMatchObject({
      offerMode: 'new',
      copiedOfferId: 'cdi-offer',
      offerName: 'Reserva',
      rate: '110',
    });
    expect(result.current.editedOffer).toBeNull();
  });

  it('never edits a system offer', () => {
    const { result } = render();

    act(() => result.current.chooseOffer(selicOffer));
    act(() => result.current.editOffer());

    expect(result.current.values.offerMode).toBe('existing');
    expect(result.current.editedOffer).toBeNull();
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
        conflict: null,
      }),
    );
    expect(result.current.form.formState.errors.curveId?.message).toBe(
      'Curva excluída.',
    );
  });
});
