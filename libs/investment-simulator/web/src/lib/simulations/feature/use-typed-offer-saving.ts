import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOffer, offerKeys } from '../../offers/api/offer-api';
import { useApiFetch, useToasts } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../api/simulation-api';
import {
  savedOfferValues,
  toTypedOfferInput,
  type SimulationFormValues,
} from '../utils/simulation-form';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';

export interface SimulationSaveCallbacks {
  // The typed terms became this offer, which the form now chooses.
  onOfferSaved(offerId: string): void;
  onProblem(problem: SaveProblem): void;
}

// Typed terms are saved as the user's own offer before the simulation that
// uses them, so each request changes one aggregate. A simulation rejected
// afterwards leaves the offer saved and chosen.
export function useTypedOfferSaving() {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const toasts = useToasts();

  const save = useMutation({
    retry: 0,
    mutationFn: (values: SimulationFormValues) =>
      createOffer(fetchFn, toTypedOfferInput(values)),
    // Awaited so the form chooses an offer the options already list.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
        queryClient.invalidateQueries({ queryKey: offerKeys.lists() }),
      ]),
  });

  return {
    /** The values with a chosen offer, or null when saving the typed terms failed. */
    choose: async (
      values: SimulationFormValues,
      callbacks: SimulationSaveCallbacks,
    ): Promise<SimulationFormValues | null> => {
      save.reset();
      if (values.offerMode === 'existing') return values;
      try {
        const { offerId } = await save.mutateAsync(values);
        callbacks.onOfferSaved(offerId);
        return savedOfferValues(values, offerId);
      } catch (error: unknown) {
        callbacks.onProblem(describeSaveProblem(error, 'new'));
        return null;
      }
    },
    /** Says where the offer went when the simulation using it was not saved. */
    reportKept: (typed: SimulationFormValues, chosen: SimulationFormValues) => {
      if (typed.offerMode === 'existing') return;
      toasts.add({
        title: `Oferta ${typed.offerName.trim()} salva em Ofertas`,
        data: {
          link: { to: `/ofertas/${chosen.offerId}`, label: 'Ver oferta' },
        },
      });
    },
    pending: save.isPending,
    problem:
      !save.isPending && save.error
        ? describeSaveProblem(save.error, 'new')
        : null,
    reset: save.reset,
  };
}
