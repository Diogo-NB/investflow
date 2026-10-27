import { act, renderHook } from '@testing-library/react';
import {
  cdiCurve,
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
      offerName: 'CDB 105% do CDI (cópia)',
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

  it('types terms from blank, keeping the investment and a valid curve', () => {
    const { result } = render();

    act(() => result.current.typeTerms());

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

  it('reports no chosen offer when the saved one is no longer listed', () => {
    const { result } = render({ offers: [selicOffer] });

    expect(result.current.offer).toBeUndefined();
  });

  it('warns when the chosen curve does not cover the period', () => {
    const { result } = render();
    expect(result.current.coverageWarning).toBeNull();

    act(() => result.current.form.setValue('maturityDate', '2029-06-01'));

    expect(result.current.coverageWarning).toEqual(cdiCurve.coverage);
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
