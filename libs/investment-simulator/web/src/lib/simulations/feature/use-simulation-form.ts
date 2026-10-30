import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import type {
  OfferOption,
  RemunerationOption,
} from '../models/simulation.types';
import type { SaveProblem } from '../utils/simulation-save-problem';
import {
  startsBeforeCurve,
  defaultCurveId,
  offerTermValues,
  remunerationOption,
  simulationFormSchema,
  type SimulationFormValues,
} from '../utils/simulation-form';

const EDIT = { shouldDirty: true, shouldValidate: false } as const;

const TERM_FIELDS = [
  'titleType',
  'issuerName',
  'remunerationKind',
  'rate',
  'maturityDate',
  'redemptionKind',
] as const;

interface SimulationFormOptions {
  readonly initialValues: SimulationFormValues;
  readonly offers: readonly OfferOption[];
  readonly remunerations: readonly RemunerationOption[];
}

export function useSimulationForm({
  initialValues,
  offers,
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
  const curve = curveOptions.find((option) => option.id === values.curveId);
  const offer = offers.find((option) => option.id === values.offerId);

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

  function chooseOffer(chosen: OfferOption) {
    setValues({
      offerMode: 'existing',
      offerId: chosen.id,
      ...offerTermValues(
        chosen,
        { curveId: form.getValues('curveId') },
        remunerations,
      ),
    });
  }

  /** Copies the chosen offer's terms into a new private offer to adjust. */
  function duplicateOffer() {
    if (!offer) return;
    setValues({
      ...offerTermValues(
        offer,
        { curveId: form.getValues('curveId') },
        remunerations,
      ),
      offerMode: 'new',
      offerName: offer.name ? `${offer.name} (cópia)` : '',
    });
  }

  function typeTerms() {
    const blank = initialTerms();
    setValues({ ...blank, offerMode: 'new', offerName: '' });
  }

  /** Chooses the offer the typed terms were saved as; the terms stay. */
  function chooseSavedOffer(offerId: string) {
    setValues({ offerMode: 'existing', offerId, offerName: '' });
  }

  /** Back to the chosen offer, discarding the typed terms. */
  function backToChosenOffer() {
    if (offer) chooseOffer(offer);
    else setValues({ offerMode: 'existing' });
    form.clearErrors([...TERM_FIELDS, 'offerName']);
  }

  function initialTerms(): Partial<SimulationFormValues> {
    const kind: RemunerationKind = 'CDI_PERCENTAGE';
    const keepsCurve = (
      remunerationOption(remunerations, kind)?.curves ?? []
    ).some((option) => option.id === form.getValues('curveId'));
    return {
      titleType: 'CDB',
      issuerName: '',
      remunerationKind: kind,
      rate: '',
      maturityDate: '',
      redemptionKind: 'AT_MATURITY',
      curveId: keepsCurve
        ? form.getValues('curveId')
        : defaultCurveId(kind, remunerations),
    };
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
    // The visible offer chosen; undefined when none is, or it was deleted.
    offer,
    index: remuneration?.index ?? null,
    curveOptions,
    curve,
    // Curve dates that may not cover the period; the API has the final word.
    startsBeforeCurve: startsBeforeCurve(values.investmentDate, curve),
    changeKind,
    chooseOffer,
    duplicateOffer,
    typeTerms,
    backToChosenOffer,
    chooseSavedOffer,
    showProblem,
  };
}
