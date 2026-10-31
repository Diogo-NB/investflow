import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { changesOfferTerms } from '../../offers/utils/offer-form';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import type {
  OfferOption,
  RemunerationOption,
} from '../models/simulation.types';
import type { SaveProblem } from '../utils/simulation-save-problem';
import {
  startsBeforeCurve,
  defaultCurveId,
  offerFormValues,
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
  // The offer as its edit started; edits are measured against it, never a
  // later read.
  const [editBaseline, setEditBaseline] = useState<OfferOption | null>(null);
  const editedOffer = values.offerMode === 'editing' ? editBaseline : null;

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
      copiedOfferId: '',
      offerName: '',
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
      copiedOfferId: offer.id,
      offerName: offer.name ? `${offer.name} (cópia)` : '',
    });
  }

  function newOffer() {
    const blank = initialTerms();
    setValues({ ...blank, offerMode: 'new', copiedOfferId: '', offerName: '' });
  }

  /** Opens the chosen own offer's terms for editing in place. */
  function editOffer(edited: OfferOption | undefined = offer) {
    if (!edited || edited.origin !== 'OWN') return;
    setEditBaseline(edited);
    setValues({
      ...offerTermValues(
        edited,
        { curveId: form.getValues('curveId') },
        remunerations,
      ),
      offerId: edited.id,
    });
    // Opening the edit changes nothing yet, so it leaves nothing to save or
    // discard.
    form.setValue('offerMode', 'editing');
    form.setValue('offerName', edited.name ?? '');
    form.clearErrors([...TERM_FIELDS, 'offerName']);
  }

  /** The edited terms become a copy of the offer, which stays unchanged. */
  function saveAsNewOffer() {
    if (!editedOffer) return;
    setValues({ offerMode: 'new', copiedOfferId: editedOffer.id });
  }

  /** Back to the offer's saved terms; the investment keeps its edits. */
  function discardOfferEdits() {
    if (editedOffer) chooseOffer(editedOffer);
    form.clearErrors([...TERM_FIELDS, 'offerName']);
  }

  /** Chooses the offer the edited or typed terms were saved as; the terms stay. */
  function chooseSavedOffer(offerId: string) {
    setValues({
      offerMode: 'existing',
      offerId,
      copiedOfferId: '',
      offerName: '',
    });
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

  const editedRemuneration = editedOffer
    ? remunerationOption(remunerations, editedOffer.remunerationTerms.kind)
    : undefined;

  return {
    form,
    values,
    // The visible offer chosen; undefined when none is, or it was deleted.
    offer,
    // The offer being edited, as its edit started; null in other modes.
    editedOffer,
    // Saving the edit changes what a calculation reads, so every simulation
    // using the offer recalculates.
    recalculatesOtherSimulations:
      editedOffer !== null &&
      changesOfferTerms(editedOffer, offerFormValues(values)),
    // The edit moves the offer to another index (or none), which the other
    // simulations' curves no longer match.
    changesIndex:
      editedOffer !== null &&
      (editedRemuneration?.index ?? null) !== (remuneration?.index ?? null),
    index: remuneration?.index ?? null,
    curveOptions,
    curve,
    // Curve dates that may not cover the period; the API has the final word.
    startsBeforeCurve: startsBeforeCurve(values.investmentDate, curve),
    changeKind,
    chooseOffer,
    duplicateOffer,
    newOffer,
    editOffer,
    saveAsNewOffer,
    discardOfferEdits,
    backToChosenOffer,
    chooseSavedOffer,
    showProblem,
  };
}
