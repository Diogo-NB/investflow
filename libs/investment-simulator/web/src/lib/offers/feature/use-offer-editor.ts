import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../../simulations/api/simulation-api';
import {
  createOffer,
  editOffer,
  offerDetailQuery,
  offerKeys,
} from '../api/offer-api';
import type { OfferSummary } from '../models/offer.types';
import {
  blankOfferValues,
  offerEdit,
  offerValues,
  toOfferInput,
  type OfferField,
  type OfferFormValues,
} from '../utils/offer-form';
import { offerListSearch } from '../utils/offer-list-search';
import { useOfferSimulations } from './use-offer-details';

export interface OfferSaveProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: OfferField | null;
  // The offer changed elsewhere; reloading shows the saved version.
  readonly conflict: boolean;
}

// The API explains the failure; the form only needs to know where to point.
const FIELD_BY_CODE: Readonly<Record<string, OfferField>> = {
  INVALID_OFFER: 'name',
  INVALID_RATE: 'rate',
};

function describeProblem(error: unknown): OfferSaveProblem {
  if (!(error instanceof ApiError)) {
    return {
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      field: null,
      conflict: false,
    };
  }
  return {
    message:
      error.userMessage ?? 'Não foi possível concluir agora. Tente novamente.',
    field: (error.code && FIELD_BY_CODE[error.code]) || null,
    conflict: error.code === 'OFFER_REVISION_CONFLICT',
  };
}

interface SaveRequest {
  readonly values: OfferFormValues;
  // The offer the form started from; absent when creating one.
  readonly baseline: OfferSummary | null;
  // Runs before leaving, while the save is still pending, so the unsaved
  // changes guard never asks.
  readonly onSaved: () => void;
}

export function useOfferEditor(offerId: string | undefined) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listSearch = offerListSearch(searchParams);
  const detail = useQuery({
    ...offerDetailQuery(fetchFn, offerId ?? ''),
    enabled: offerId !== undefined,
  });
  const simulations = useOfferSimulations(offerId);
  // Bumped after a reload so the editor restarts from the version read.
  const [loadGeneration, setLoadGeneration] = useState(0);

  const save = useMutation({
    retry: 0,
    mutationFn: async ({ values, baseline }: SaveRequest) => {
      if (!baseline) {
        const created = await createOffer(fetchFn, toOfferInput(values));
        return created.offerId;
      }
      await editOffer(fetchFn, baseline.id, offerEdit(baseline, values));
      return baseline.id;
    },
    onSuccess: async (savedId, { onSaved }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.all }),
        // Their simulations show the offer's new terms.
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]);
      onSaved();
      navigate(`/ofertas/${savedId}${listSearch}`, {
        replace: offerId === undefined,
      });
    },
  });

  // Rendered pending state lags a double click; this guard does not.
  const saving = useRef(false);

  function run(
    values: OfferFormValues,
    baseline: OfferSummary | null,
    callbacks: {
      onSaved: () => void;
      onProblem: (problem: OfferSaveProblem) => void;
    },
  ) {
    if (saving.current) return;
    saving.current = true;
    save.mutate(
      { values, baseline, onSaved: callbacks.onSaved },
      {
        onError: (error) => callbacks.onProblem(describeProblem(error)),
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  }

  const setup = (() => {
    if (offerId === undefined) {
      return {
        status: 'ready',
        offer: null,
        initialValues: blankOfferValues(),
        loadGeneration,
      } as const;
    }
    if (detail.data) {
      // System offers are read only; they can only be duplicated.
      return detail.data.origin === 'SYSTEM'
        ? ({ status: 'read-only', offer: detail.data } as const)
        : ({
            status: 'ready',
            offer: detail.data,
            initialValues: offerValues(detail.data),
            loadGeneration,
          } as const);
    }
    if (detail.isError) {
      return detail.error instanceof ApiError && detail.error.status === 404
        ? ({ status: 'missing' } as const)
        : ({ status: 'error', retrying: detail.isFetching } as const);
    }
    return { status: 'loading' } as const;
  })();

  return {
    setup,
    listSearch,
    retrySetup: () => void detail.refetch(),
    simulations: simulations.state,
    save: {
      run,
      pending: save.isPending,
      problem:
        !save.isPending && save.error ? describeProblem(save.error) : null,
      // Loads the version saved elsewhere; the editor restarts from it.
      reload: async () => {
        save.reset();
        await detail.refetch();
        setLoadGeneration((generation) => generation + 1);
      },
    },
  };
}
