import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { simulationKeys } from '../../simulations/api/simulation-api';
import {
  createCurve,
  curveDetailQuery,
  curveKeys,
  curveListQuery,
  editCurve,
} from '../api/curve-api';
import type { CurveDetail, CurveSummary } from '../models/curve.types';
import {
  blankCurveValues,
  curveEdit,
  curveValues,
  toCurveInput,
  type CurveFormValues,
} from '../utils/curve-form';
import { curveListSearch, parseCurveIndex } from '../utils/curve-list-search';
import { useCurveSimulations } from './use-curve-details';

export interface CurveSaveProblem {
  // Shown above the actions: the form checks every field rule before saving,
  // so the API has no single field to point to.
  readonly message: string;
  // The curve changed elsewhere; reloading shows the saved version.
  readonly conflict: boolean;
}

function describeProblem(error: unknown): CurveSaveProblem {
  if (!(error instanceof ApiError)) {
    return {
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      conflict: false,
    };
  }
  return {
    message:
      error.userMessage ?? 'Não foi possível concluir agora. Tente novamente.',
    conflict: error.code === 'CURVE_REVISION_CONFLICT',
  };
}

export type BaseCurvesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly curves: readonly CurveSummary[] };

export type BaseCopyState = 'idle' | 'loading' | 'failed';

/** Curves a new one can copy its intervals from, and reading the chosen one. */
function useBaseCurves(enabled: boolean) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const list = useQuery({ ...curveListQuery(fetchFn, {}), enabled });
  const [copy, setCopy] = useState<BaseCopyState>('idle');
  // Only the latest choice applies when an earlier read finishes after it.
  const latest = useRef(0);

  const state: BaseCurvesState = list.data
    ? { status: 'ready', curves: list.data }
    : list.isError
      ? { status: 'error', retrying: list.isFetching }
      : { status: 'loading' };

  return {
    state,
    copy,
    retry: () => void list.refetch(),
    /** The chosen curve's content; null when it failed or a newer choice won. */
    read: async (id: string): Promise<CurveDetail | null> => {
      const request = ++latest.current;
      setCopy('loading');
      try {
        const curve = await queryClient.fetchQuery(
          curveDetailQuery(fetchFn, id),
        );
        if (request !== latest.current) return null;
        setCopy('idle');
        return curve;
      } catch {
        if (request === latest.current) setCopy('failed');
        return null;
      }
    },
  };
}

interface EditRequest {
  readonly baseline: CurveDetail;
  readonly values: CurveFormValues;
}

export function useCurveEditor(curveId: string | undefined) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listSearch = curveListSearch(searchParams);
  const detail = useQuery({
    ...curveDetailQuery(fetchFn, curveId ?? ''),
    enabled: curveId !== undefined,
  });
  const simulations = useCurveSimulations(curveId);
  // Bumped after a reload so the editor restarts from the version read.
  const [loadGeneration, setLoadGeneration] = useState(0);
  const bases = useBaseCurves(curveId === undefined);

  // Both run their follow-up while still pending, so the unsaved-changes
  // guard lets the navigation through. Only steps that cannot fail belong
  // there: a failure would report the saved curve as unsaved.
  const create = useMutation({
    retry: 0,
    mutationFn: (values: CurveFormValues) =>
      createCurve(fetchFn, toCurveInput(values)),
    onSuccess: async ({ curveId: createdId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: curveKeys.lists() }),
        // The new curve joins the simulation form's options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
      ]);
      navigate(`/curvas/${createdId}${listSearch}`, { replace: true });
    },
  });
  const edit = useMutation({
    retry: 0,
    mutationFn: ({ baseline, values }: EditRequest) =>
      editCurve(fetchFn, baseline.id, curveEdit(baseline, values)),
    onSuccess: async (_, { baseline }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: curveKeys.all }),
        // Simulation options list the curve, and its simulations are outdated.
        queryClient.invalidateQueries({ queryKey: simulationKeys.all }),
      ]);
      navigate(`/curvas/${baseline.id}${listSearch}`);
    },
  });
  const mutation = curveId === undefined ? create : edit;

  // Rendered pending state lags a double click; this guard does not.
  const saving = useRef(false);
  const settle = {
    onSettled: () => {
      saving.current = false;
    },
  };

  const setup = (() => {
    if (curveId === undefined) {
      return {
        status: 'ready',
        curve: null,
        // A curve created from a filtered list starts with its index.
        initialValues: blankCurveValues(
          parseCurveIndex(searchParams).index ?? '',
        ),
        loadGeneration,
      } as const;
    }
    if (detail.data) {
      // System curves are read only; they can only be duplicated.
      return detail.data.origin === 'SYSTEM'
        ? ({ status: 'read-only', curve: detail.data } as const)
        : ({
            status: 'ready',
            curve: detail.data,
            initialValues: curveValues(detail.data),
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
    bases,
    save: {
      create: (values: CurveFormValues) => {
        if (saving.current) return;
        saving.current = true;
        create.mutate(values, settle);
      },
      edit: (baseline: CurveDetail, values: CurveFormValues) => {
        if (saving.current) return;
        saving.current = true;
        edit.mutate({ baseline, values }, settle);
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
