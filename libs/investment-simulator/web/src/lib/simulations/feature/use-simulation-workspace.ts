import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
import { investmentPlanKeys } from '../../investment-plans/api/investment-plan-api';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  deleteSimulation,
  editSimulation,
  recalculateSimulation,
  simulationKeys,
  simulationOptionsQuery,
  simulationWorkspaceQuery,
  WORKSPACE_REFRESH_MS,
} from '../api/simulation-api';
import {
  simulationValues,
  toSimulationInput,
  type SimulationFormValues,
} from '../utils/simulation-form';
import { listSearch } from '../utils/simulation-list-search';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';
import {
  useSimulationTermsSaving,
  type SimulationSaveCallbacks,
  type SimulationTermsSave,
} from './use-simulation-terms-saving';

export interface EditCallbacks extends SimulationSaveCallbacks {
  // values are the ones saved, with the offer the simulation now uses;
  // revision is the one the next edit must send.
  onSaved(values: SimulationFormValues, revision: number): void;
}

export interface SimulationEdit extends SimulationTermsSave {
  // The revision the form started from.
  readonly revision: number;
}

export function useSimulationWorkspace(simulationId: string) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const termsSaving = useSimulationTermsSaving();

  const options = useQuery(simulationOptionsQuery(fetchFn));
  // Polled whatever the calculation status; TanStack Query pauses the
  // interval while the tab is hidden and refetches on focus.
  const source = useQuery({
    ...simulationWorkspaceQuery(fetchFn, simulationId),
    refetchInterval: WORKSPACE_REFRESH_MS,
  });
  // Bumped after a reload so the editor restarts from the version read; polls
  // never restart it, so unsaved edits survive them.
  const [loadGeneration, setLoadGeneration] = useState(0);

  const edit = useMutation({
    retry: 0,
    // A rejected edit saves nothing, so the form keeps its edits. An edit
    // sends the revision its form started from, never a polled one, so a
    // change made elsewhere is reported as a conflict.
    mutationFn: ({
      values,
      revision,
    }: {
      values: SimulationFormValues;
      revision: number;
    }) =>
      editSimulation(fetchFn, simulationId, {
        ...toSimulationInput(values),
        revision,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: simulationKeys.workspace(simulationId),
        }),
      ]),
  });

  const remove = useMutation({
    retry: 0,
    mutationFn: () => deleteSimulation(fetchFn, simulationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: simulationKeys.lists() });
      // The simulation left its plans, so their counts and status changed.
      // Only marked stale: refetching now would re-render this page, which
      // stays mounted until the navigation commits.
      void queryClient.invalidateQueries({
        queryKey: investmentPlanKeys.all,
        refetchType: 'none',
      });
      // Dropped only once the list has replaced this page: while a lazy
      // route loads, the page is still mounted and would refetch it.
      await navigate(`/simulacoes${listSearch(searchParams)}`);
      queryClient.removeQueries({
        queryKey: simulationKeys.workspace(simulationId),
      });
    },
  });

  const recalculate = useMutation({
    retry: 0,
    mutationFn: () => recalculateSimulation(fetchFn, simulationId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: simulationKeys.workspace(simulationId),
      }),
  });

  // Rendered pending state lags a double click; these guards do not.
  const saving = useRef(false);
  const requesting = useRef(false);

  async function run(request: SimulationEdit, callbacks: EditCallbacks) {
    if (saving.current) return;
    saving.current = true;
    edit.reset();
    // The terms go first: the simulation's checks read them.
    const chosen = await termsSaving.save(request, callbacks);
    if (!chosen) {
      saving.current = false;
      return;
    }
    edit.mutate(
      { values: chosen, revision: request.revision },
      {
        onSuccess: (saved) => callbacks.onSaved(chosen, saved.revision),
        onError: (error) => {
          callbacks.onProblem(describeSaveProblem(error));
        },
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  }

  const problem: SaveProblem | null =
    termsSaving.problem ??
    (!edit.isPending && edit.error ? describeSaveProblem(edit.error) : null);

  const setup = (() => {
    if (options.isError || source.isError) {
      const missing =
        source.error instanceof ApiError && source.error.status === 404;
      return missing
        ? ({ status: 'missing' } as const)
        : ({ status: 'error' } as const);
    }
    if (!options.data || !source.data) {
      return { status: 'loading' } as const;
    }
    return {
      status: 'ready',
      loadGeneration,
      workspace: source.data,
      initialValues: simulationValues(source.data, options.data.remunerations),
      options: options.data,
    } as const;
  })();

  return {
    setup,
    retrySetup: () => {
      for (const query of [options, source]) {
        if (query.isError) void query.refetch();
      }
    },
    edit: {
      run: (request: SimulationEdit, callbacks: EditCallbacks) =>
        void run(request, callbacks),
      pending: termsSaving.pending || edit.isPending,
      problem,
      // Loads the version saved elsewhere; the editor restarts from it.
      reload: async () => {
        termsSaving.reset();
        edit.reset();
        await source.refetch();
        setLoadGeneration((generation) => generation + 1);
      },
    },
    recalculate: {
      run: () => {
        if (requesting.current) return;
        requesting.current = true;
        recalculate.mutate(undefined, {
          onSettled: () => {
            requesting.current = false;
          },
        });
      },
      pending: recalculate.isPending,
      failed: recalculate.isError,
    },
    remove: {
      run: () => {
        if (!remove.isPending) remove.mutate();
      },
      pending: remove.isPending,
      failed: remove.isError,
    },
  };
}
