import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import type {
  OfferOption,
  RemunerationOption,
} from '../models/simulation.types';
import type { SaveProblem } from '../utils/simulation-save-problem';
import {
  changesOfferTerms,
  defaultCurveId,
  offerTermValues,
  remunerationOption,
  simulationFormSchema,
  startsBeforeCurve,
  type SimulationFormValues,
} from '../utils/simulation-form';

const EDIT = { shouldDirty: true, shouldValidate: false } as const;

type ChosenOffer = Omit<OfferOption, 'unsupportedReason'>;

interface SimulationFormOptions {
  readonly initialValues: SimulationFormValues;
  // The catalog offers the user can choose.
  readonly offers: readonly OfferOption[];
  readonly remunerations: readonly RemunerationOption[];
  // The offer holding the saved simulation's own terms; null otherwise.
  readonly ownTermsOffer?: ChosenOffer | null;
}

export function useSimulationForm({
  initialValues,
  offers,
  remunerations,
  ownTermsOffer = null,
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
  const curve = curveOptions.find((option) => option.id === values.curveId);
  const isOwnTerms =
    ownTermsOffer !== null && values.offerId === ownTermsOffer.id;
  const offer: ChosenOffer | undefined = isOwnTerms
    ? (ownTermsOffer ?? undefined)
    : offers.find((option) => option.id === values.offerId);

  function setValues(next: Partial<SimulationFormValues>) {
    for (const [field, value] of Object.entries(next)) {
      form.setValue(field as keyof SimulationFormValues, value, EDIT);
    }
    form.clearErrors(Object.keys(next) as (keyof SimulationFormValues)[]);
  }

  /** A new kind changes the rate's unit, so the rate and curve start over. */
  function changeKind(next: RemunerationKind) {
    setValues({
      remunerationKind: next,
      rate: '',
      curveId: defaultCurveId(next, remunerations),
    });
  }

  /** Follows the offer: its terms replace the typed ones; the investment stays. */
  function chooseOffer(chosen: ChosenOffer) {
    setValues({
      offerId: chosen.id,
      ...offerTermValues(
        chosen,
        { curveId: form.getValues('curveId') },
        remunerations,
      ),
    });
  }

  function showProblem(problem: SaveProblem) {
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
    // The offer the terms came from: a catalog offer or the simulation's own;
    // undefined for terms typed from scratch or a deleted offer.
    offer,
    // The terms are the saved simulation's own, edited in place on save.
    isOwnTerms,
    // Saving would store terms that differ from the offer they came from.
    termsChanged: changesOfferTerms(offer, values),
    index: remuneration?.index ?? null,
    curveOptions,
    curve,
    // Curve dates that may not cover the period; the API has the final word.
    startsBeforeCurve: startsBeforeCurve(values.investmentDate, curve),
    changeKind,
    chooseOffer,
    showProblem,
  };
}
