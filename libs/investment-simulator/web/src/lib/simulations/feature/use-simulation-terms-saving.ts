import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createSimulationScopedOffer,
  editOffer,
} from '../../offers/api/offer-api';
import type {
  OfferEdit,
  OfferSummary,
  OfferTermsInput,
} from '../../offers/models/offer.types';
import { offerEdit, toOfferInput } from '../../offers/utils/offer-form';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../api/simulation-api';
import {
  changesOfferTerms,
  offerFormValues,
  type SimulationFormValues,
} from '../utils/simulation-form';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';

export interface SimulationSaveCallbacks {
  onProblem(problem: SaveProblem): void;
}

export interface SimulationTermsSave {
  readonly values: SimulationFormValues;
  // The offer the terms came from; undefined for terms typed from scratch or
  // an offer that was deleted.
  readonly offer: OfferSummary | undefined;
  // The offer holds this simulation's own terms, so it is edited in place.
  readonly isOwnTerms: boolean;
}

// Terms that differ from their offer are saved as the simulation's own before
// the simulation, so each request changes one aggregate. Own terms never
// reach Ofertas or another simulation.
export function useSimulationTermsSaving() {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();

  const createOwnTerms = useMutation({
    retry: 0,
    mutationFn: (
      input: OfferTermsInput & { readonly basedOnOfferId: string | null },
    ) => createSimulationScopedOffer(fetchFn, input),
  });
  const editOwnTerms = useMutation({
    retry: 0,
    mutationFn: ({ offerId, change }: { offerId: string; change: OfferEdit }) =>
      editOffer(fetchFn, offerId, change),
    // Read again so a retry after a rejected simulation sends the offer's new
    // revision.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
  });

  /** The values the simulation request sends, or null when the terms failed. */
  async function save(
    { values, offer, isOwnTerms }: SimulationTermsSave,
    callbacks: SimulationSaveCallbacks,
  ): Promise<SimulationFormValues | null> {
    createOwnTerms.reset();
    editOwnTerms.reset();
    if (!changesOfferTerms(offer, values)) return values;
    try {
      if (isOwnTerms && offer) {
        await editOwnTerms.mutateAsync({
          offerId: offer.id,
          change: offerEdit(offer, offerFormValues(values)),
        });
        return values;
      }
      const { offerId } = await createOwnTerms.mutateAsync({
        ...toOfferInput(offerFormValues(values)),
        basedOnOfferId: offer?.id ?? null,
      });
      return { ...values, offerId };
    } catch (error: unknown) {
      callbacks.onProblem(describeSaveProblem(error));
      return null;
    }
  }

  const pending = createOwnTerms.isPending || editOwnTerms.isPending;
  const error = createOwnTerms.error ?? editOwnTerms.error;

  return {
    save,
    pending,
    problem: !pending && error ? describeSaveProblem(error) : null,
    reset: () => {
      createOwnTerms.reset();
      editOwnTerms.reset();
    },
  };
}
