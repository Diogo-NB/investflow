import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../http/api-error';
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

export interface EditCallbacks {
  // revision is the one the next edit must send.
  onSaved(values: SimulationFormValues, revision: number): void;
  onProblem(problem: SaveProblem): void;
}

export function useSimulationWorkspace(simulationId: string) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
    // A rejected request saves nothing, so the form keeps its edits. An edit
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
        // A new private offer joins the options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
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

  function run(
    values: SimulationFormValues,
    revision: number,
    callbacks: EditCallbacks,
  ) {
    if (saving.current) return;
    saving.current = true;
    edit.mutate(
      { values, revision },
      {
        onSuccess: (saved) => callbacks.onSaved(values, saved.revision),
        onError: (error) =>
          callbacks.onProblem(describeSaveProblem(error, values.offerMode)),
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  }

  const problem: SaveProblem | null =
    !edit.isPending && edit.error
      ? describeSaveProblem(
          edit.error,
          edit.variables?.values.offerMode ?? 'existing',
        )
      : null;

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
      initialValues: simulationValues(
        source.data.offer,
        source.data.simulation.investment,
      ),
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
      run,
      pending: edit.isPending,
      problem,
      // Loads the version saved elsewhere; the editor restarts from it.
      reload: async () => {
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
