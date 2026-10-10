import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import type {
  OfferOption,
  RemunerationOption,
} from '../models/simulation.types';
import type { CalculationProblem } from './use-simulation-workspace';
import {
  coverageGap,
  defaultCurveId,
  differsFromOffer,
  offerTermValues,
  remunerationOption,
  simulationFormSchema,
  type SimulationFormValues,
} from '../utils/simulation-form';

const EDIT = { shouldDirty: true, shouldValidate: false } as const;

interface SimulationFormOptions {
  readonly initialValues: SimulationFormValues;
  readonly remunerations: readonly RemunerationOption[];
}

export function useSimulationForm({
  initialValues,
  remunerations,
}: SimulationFormOptions) {
  const form = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationFormSchema(remunerations)),
    defaultValues: initialValues,
    mode: 'onTouched',
  });

  // The editor derives its hints from every value, so it follows each change.
  const watched = useWatch({ control: form.control });
  // Every field is registered with a default, so the watched values are complete.
  const values: SimulationFormValues = { ...initialValues, ...watched };
  const remuneration = remunerationOption(
    remunerations,
    values.remunerationKind,
  );
  const curveOptions = remuneration?.curves ?? [];

  /** A new kind changes the rate's unit, so the rate and curve start over. */
  function changeKind(next: RemunerationKind) {
    form.setValue('remunerationKind', next, EDIT);
    form.setValue('rate', '', EDIT);
    form.setValue('indexCurveId', defaultCurveId(next, remunerations), EDIT);
    form.clearErrors(['rate', 'indexCurveId', 'remunerationKind']);
  }

  function applyOffer(offer: OfferOption | null) {
    form.setValue('offerId', offer?.id ?? '', EDIT);
    if (!offer) return;
    const terms = offerTermValues(
      offer,
      { indexCurveId: form.getValues('indexCurveId') },
      remunerations,
    );
    for (const [field, value] of Object.entries(terms)) {
      form.setValue(field as keyof typeof terms, value, EDIT);
    }
    form.clearErrors(Object.keys(terms) as (keyof typeof terms)[]);
  }

  function showProblem(problem: CalculationProblem) {
    if (!problem.field) return;
    form.setError(
      problem.field,
      { type: 'server', message: problem.message },
      { shouldFocus: true },
    );
  }

  return {
    form,
    values,
    index: remuneration?.index ?? null,
    curveOptions,
    // Curve dates that may not cover the period; the API has the final word.
    coverageWarning: coverageGap(
      values,
      curveOptions.find((curve) => curve.id === values.indexCurveId),
    ),
    termsChangedFrom: (offer: OfferOption | undefined) =>
      offer !== undefined && differsFromOffer(values, offer),
    changeKind,
    applyOffer,
    showProblem,
  };
}
