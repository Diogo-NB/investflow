import { act, renderHook } from '@testing-library/react';
import {
  cdiCurve,
  remunerations,
  selicCurve,
  selicOffer as offer,
} from '../../testing/simulator-fixtures';
import type { SimulationFormValues } from '../utils/simulation-form';
import { useSimulationForm } from './use-simulation-form';

const initialValues: SimulationFormValues = {
  offerId: '',
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
  options: Partial<Parameters<typeof useSimulationForm>[0]> = {},
) {
  return renderHook(() =>
    useSimulationForm({ initialValues, remunerations, ...options }),
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

  it('fills the terms from an offer and notices later edits', () => {
    const { result } = render();

    act(() => result.current.applyOffer(offer));

    expect(result.current.values).toMatchObject({
      offerId: 'offer',
      principal: '10.000',
      issuerName: 'Outro',
      remunerationKind: 'SELIC_PERCENTAGE',
      rate: '100',
      maturityDate: '2028-12-29',
      redemptionKind: 'AT_MATURITY',
      curveId: 'selic',
    });
    expect(result.current.termsChangedFrom(offer)).toBe(false);

    act(() => result.current.form.setValue('rate', '110'));
    expect(result.current.termsChangedFrom(offer)).toBe(true);

    act(() => result.current.applyOffer(null));
    expect(result.current.values).toMatchObject({ offerId: '', rate: '110' });
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
      }),
    );
    expect(result.current.form.formState.errors.curveId?.message).toBe(
      'Curva excluída.',
    );
  });
});
