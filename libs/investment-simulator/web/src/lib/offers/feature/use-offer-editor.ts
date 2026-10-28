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

interface EditRequest {
  readonly baseline: OfferSummary;
  readonly values: OfferFormValues;
}

type OnProblem = (problem: OfferSaveProblem) => void;

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

  // Both run their follow-up while still pending, so the unsaved-changes
  // guard lets the navigation through. Only steps that cannot fail belong
  // there: a failure would report the saved offer as unsaved.
  const create = useMutation({
    retry: 0,
    mutationFn: (values: OfferFormValues) =>
      createOffer(fetchFn, toOfferInput(values)),
    onSuccess: async ({ offerId: createdId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.lists() }),
        // The new offer joins the simulation form's options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
      ]);
      navigate(`/ofertas/${createdId}${listSearch}`, { replace: true });
    },
  });
  const edit = useMutation({
    retry: 0,
    mutationFn: ({ baseline, values }: EditRequest) =>
      editOffer(fetchFn, baseline.id, offerEdit(baseline, values)),
    onSuccess: async (_, { baseline }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offerKeys.all }),
        // Their simulations show the offer's new terms.
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]);
      navigate(`/ofertas/${baseline.id}${listSearch}`);
    },
  });
  const mutation = offerId === undefined ? create : edit;

  // Rendered pending state lags a double click; this guard does not.
  const saving = useRef(false);
  const settle = (onProblem: OnProblem) => ({
    onError: (error: unknown) => onProblem(describeProblem(error)),
    onSettled: () => {
      saving.current = false;
    },
  });

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
      create: (values: OfferFormValues, onProblem: OnProblem) => {
        if (saving.current) return;
        saving.current = true;
        create.mutate(values, settle(onProblem));
      },
      edit: (
        baseline: OfferSummary,
        values: OfferFormValues,
        onProblem: OnProblem,
      ) => {
        if (saving.current) return;
        saving.current = true;
        edit.mutate({ baseline, values }, settle(onProblem));
      },
      pending: mutation.isPending,
      problem:
        !mutation.isPending && mutation.error
          ? describeProblem(mutation.error)
          : null,
      // Loads the version saved elsewhere; the editor restarts from it.
      reload: async () => {
        edit.reset();
        await detail.refetch();
        setLoadGeneration((generation) => generation + 1);
      },
    },
  };
}
