import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiError } from '../../http/api-error';
import {
  editOffer,
  moveOfferToCatalog,
  offerKeys,
} from '../../offers/api/offer-api';
import { offerTermsLabel } from '../../offers/models/offer-terms';
import { offerEdit } from '../../offers/utils/offer-form';
import { useApiFetch, useToasts } from '../../routes/investment-simulator-deps';
import { editSimulation, simulationKeys } from '../api/simulation-api';
import type {
  OfferOption,
  SimulationOptions,
  SimulationWorkspace,
} from '../models/simulation.types';
import {
  offerFormValues,
  offerTermValues,
  simulationValues,
} from '../utils/simulation-form';

interface TermsActionsOptions {
  readonly workspace: SimulationWorkspace;
  readonly options: SimulationOptions;
  // The revision the simulation's next edit must send.
  readonly revision: number;
  // Restarts the editor from the saved version once an action is done.
  readonly onDone: () => Promise<void>;
}

function failureMessage(error: unknown): string {
  return error instanceof ApiError && error.userMessage
    ? error.userMessage
    : 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

// What a simulation with its own terms can do with them. Each action works on
// the saved terms, so the screen offers them only without unsaved edits.
export function useSimulationTermsActions({
  workspace,
  options,
  revision,
  onDone,
}: TermsActionsOptions) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const toasts = useToasts();
  const { offer, simulation } = workspace;
  const isOwnTerms = offer.scope === 'SIMULATION';
  // The base only while it can still be chosen: listed and not deleted.
  const base: OfferOption | undefined =
    isOwnTerms && offer.basedOn && !offer.basedOn.deleted
      ? options.offers.find((option) => option.id === offer.basedOn?.id)
      : undefined;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      queryClient.invalidateQueries({ queryKey: offerKeys.all }),
    ]);
    await onDone();
  };

  // Points the simulation at the base, keeping a curve its index accepts.
  const followBase = (target: OfferOption) => {
    const saved = simulationValues(workspace, options.remunerations);
    const { curveId } = offerTermValues(target, saved, options.remunerations);
    return editSimulation(fetchFn, simulation.id, {
      offerId: target.id,
      investment: { ...simulation.investment, curveId: curveId || null },
      revision,
    });
  };

  const returnToOffer = useMutation({
    retry: 0,
    mutationFn: (target: OfferOption) => followBase(target),
    onSuccess: refresh,
  });

  // The base takes the own terms, then the simulation follows it again.
  const applyToOffer = useMutation({
    retry: 0,
    mutationFn: async (target: OfferOption) => {
      const terms = offerFormValues(
        simulationValues(workspace, options.remunerations),
      );
      await editOffer(fetchFn, target.id, offerEdit(target, terms));
      return followBase(target);
    },
    onSuccess: refresh,
  });

  const moveToCatalog = useMutation({
    retry: 0,
    mutationFn: () => moveOfferToCatalog(fetchFn, offer.id, offer.revision),
    onSuccess: async () => {
      toasts.add({
        title: `Oferta ${offerTermsLabel(offer)} salva em Minhas`,
        data: { link: { to: `/ofertas/${offer.id}`, label: 'Ver oferta' } },
      });
      await refresh();
    },
    onError: (error) =>
      toasts.add({
        type: 'error',
        title: 'Não foi possível salvar como oferta',
        description: failureMessage(error),
      }),
  });

  // Rendered pending state lags a double click; this guard does not.
  const running = useRef(false);
  const once =
    <T>(run: (input: T) => Promise<unknown>) =>
    (input: T) => {
      if (running.current) return;
      running.current = true;
      void run(input)
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
        });
    };

  const pending =
    returnToOffer.isPending ||
    applyToOffer.isPending ||
    moveToCatalog.isPending;

  return {
    isOwnTerms,
    base,
    // Applying needs an offer the user owns, of the same title type, since a
    // title type never changes.
    canApply: base?.origin === 'OWN' && base.titleType === offer.titleType,
    pending,
    returnToOffer: {
      run: once((target: OfferOption) => returnToOffer.mutateAsync(target)),
      failed: returnToOffer.error ? failureMessage(returnToOffer.error) : null,
      reset: returnToOffer.reset,
    },
    applyToOffer: {
      run: once((target: OfferOption) => applyToOffer.mutateAsync(target)),
      failed: applyToOffer.error ? failureMessage(applyToOffer.error) : null,
      reset: applyToOffer.reset,
    },
    moveToCatalog: {
      run: once(() => moveToCatalog.mutateAsync()),
    },
  };
}
