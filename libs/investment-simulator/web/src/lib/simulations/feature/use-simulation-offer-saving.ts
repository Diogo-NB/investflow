import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOffer, editOffer, offerKeys } from '../../offers/api/offer-api';
import { offerTermsLabel } from '../../offers/models/offer-terms';
import type {
  OfferEdit,
  OfferTermsInput,
} from '../../offers/models/offer.types';
import { offerEdit, toOfferInput } from '../../offers/utils/offer-form';
import { useApiFetch, useToasts } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../api/simulation-api';
import type {
  OfferOption,
  SimulationOptions,
} from '../models/simulation.types';
import {
  offerFormValues,
  savedOfferValues,
  type SimulationFormValues,
} from '../utils/simulation-form';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';

export interface SimulationSaveCallbacks {
  // The edited or typed terms were saved as this offer, which the form now
  // chooses.
  onOfferSaved(offerId: string): void;
  onProblem(problem: SaveProblem): void;
}

export interface SimulationOfferSave {
  readonly values: SimulationFormValues;
  // The offer as its edit started; null unless the form edits it.
  readonly editedOffer: OfferOption | null;
}

// Edited and typed terms are saved as the user's own offer before the
// simulation that uses them, so each request changes one aggregate. A
// simulation rejected afterwards leaves the offer saved and chosen.
export function useSimulationOfferSaving() {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const toasts = useToasts();

  const create = useMutation({
    retry: 0,
    mutationFn: (input: OfferTermsInput) => createOffer(fetchFn, input),
    // Awaited so the form chooses an offer the options already list.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
        queryClient.invalidateQueries({ queryKey: offerKeys.lists() }),
      ]),
  });
  const edit = useMutation({
    retry: 0,
    mutationFn: ({ offerId, change }: { offerId: string; change: OfferEdit }) =>
      editOffer(fetchFn, offerId, change),
    // The options list the new terms, and every simulation using the offer
    // shows them.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.all }),
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]),
  });

  async function save(
    { values, editedOffer }: SimulationOfferSave,
    callbacks: SimulationSaveCallbacks,
  ): Promise<SimulationFormValues | null> {
    create.reset();
    edit.reset();
    try {
      if (values.offerMode === 'new') {
        const input = toOfferInput(offerFormValues(values));
        const { offerId } = await create.mutateAsync(input);
        toasts.add({
          title: `Oferta ${offerTermsLabel(input)} criada em Minhas`,
          data: { link: { to: `/ofertas/${offerId}`, label: 'Ver oferta' } },
        });
        callbacks.onOfferSaved(offerId);
        return savedOfferValues(values, offerId);
      }
      if (values.offerMode === 'editing' && editedOffer) {
        const change = offerEdit(editedOffer, offerFormValues(values));
        // The edit always carries its revision; anything else is a change.
        if (Object.keys(change).some((field) => field !== 'revision')) {
          await edit.mutateAsync({ offerId: editedOffer.id, change });
        }
        callbacks.onOfferSaved(editedOffer.id);
        return savedOfferValues(values, editedOffer.id);
      }
      return values;
    } catch (error: unknown) {
      callbacks.onProblem(describeSaveProblem(error, values.offerMode));
      return null;
    }
  }

  const failed = create.error
    ? describeSaveProblem(create.error, 'new')
    : edit.error
      ? describeSaveProblem(edit.error, 'editing')
      : null;

  return {
    save,
    /** The offers as saved now, for an edit to restart from. */
    reloadOffers: async (): Promise<readonly OfferOption[]> => {
      create.reset();
      edit.reset();
      await queryClient.refetchQueries({ queryKey: simulationKeys.options() });
      return (
        queryClient.getQueryData<SimulationOptions>(simulationKeys.options())
          ?.offers ?? []
      );
    },
    pending: create.isPending || edit.isPending,
    problem: create.isPending || edit.isPending ? null : failed,
    reset: () => {
      create.reset();
      edit.reset();
    },
  };
}
