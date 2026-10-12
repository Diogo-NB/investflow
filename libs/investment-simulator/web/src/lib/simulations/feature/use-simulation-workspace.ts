import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  createSimulation,
  deleteSimulation,
  editSimulation,
  recalculateSimulation,
  simulationKeys,
  simulationOptionsQuery,
  simulationWorkspaceQuery,
  WORKSPACE_REFRESH_MS,
} from '../api/simulation-api';
import {
  blankSimulationValues,
  simulationValues,
  toSimulationInput,
  type SimulationField,
  type SimulationFormValues,
} from '../utils/simulation-form';

export const TEMPLATE_PARAM = 'a-partir-de';

export interface SaveProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: SimulationField | null;
  // The simulation changed elsewhere; reloading shows the saved version.
  readonly conflict: boolean;
}

// The API explains the failure; the form only needs to know where to point.
const FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_CURVE_REQUIRED: 'curveId',
  INVESTMENT_CURVE_INCOMPATIBLE: 'curveId',
  INVESTMENT_CURVE_UNAVAILABLE: 'curveId',
  CURVE_NOT_FOUND: 'curveId',
  OFFER_NOT_FOUND: 'offerId',
  INVALID_OFFER: 'offerName',
  INVESTMENT_PRINCIPAL_INVALID: 'principal',
};

// Failures caused by the offer's terms, which are fields only while typed.
const TERM_FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_PERIOD_INVALID: 'maturityDate',
  INVESTMENT_TERM_TOO_SHORT: 'maturityDate',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'remunerationKind',
};

function problemField(
  error: ApiError,
  offerMode: SimulationFormValues['offerMode'],
): SimulationField | null {
  const termField = (field: SimulationField) =>
    offerMode === 'new' ? field : 'offerId';
  if (error.code === 'INVESTMENT_DATE_NOT_BUSINESS_DAY') {
    return error.details['field'] === 'maturityDate'
      ? termField('maturityDate')
      : 'investmentDate';
  }
  if (!error.code) return null;
  const term = TERM_FIELD_BY_CODE[error.code];
  return term ? termField(term) : (FIELD_BY_CODE[error.code] ?? null);
}

function describeProblem(
  error: unknown,
  offerMode: SimulationFormValues['offerMode'],
): SaveProblem {
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
    field: problemField(error, offerMode),
    conflict: error.code === 'SIMULATION_REVISION_CONFLICT',
  };
}

export interface SaveCallbacks {
  // revision is the one the next edit must send.
  onSaved?(values: SimulationFormValues, revision: number): void;
  onProblem?(problem: SaveProblem): void;
}

export function useSimulationWorkspace(simulationId: string | undefined) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId =
    simulationId === undefined ? searchParams.get(TEMPLATE_PARAM) : null;
  const sourceId = simulationId ?? templateId;

  const options = useQuery(simulationOptionsQuery(fetchFn));
  // Polled whatever the calculation status; TanStack Query pauses the
  // interval while the tab is hidden and refetches on focus.
  const source = useQuery({
    ...simulationWorkspaceQuery(fetchFn, sourceId ?? ''),
    enabled: sourceId !== null,
    refetchInterval: simulationId !== undefined && WORKSPACE_REFRESH_MS,
  });
  // Bumped after a reload so the editor restarts from the version read; polls
  // never restart it, so unsaved edits survive them.
  const [loadGeneration, setLoadGeneration] = useState(0);

  const save = useMutation({
    retry: 0,
    // A rejected request saves nothing, so the form keeps its edits. An edit
    // sends the revision its form started from, never a polled one, so a
    // change made elsewhere is reported as a conflict.
    mutationFn: async ({
      values,
      revision,
    }: {
      values: SimulationFormValues;
      revision: number;
    }) => {
      const input = toSimulationInput(values);
      if (simulationId === undefined) {
        const created = await createSimulation(fetchFn, input);
        return { savedId: created.simulationId, revision: 1 };
      }
      const edited = await editSimulation(fetchFn, simulationId, {
        ...input,
        revision,
      });
      return { savedId: simulationId, revision: edited.revision };
    },
    // Runs while the mutation is still pending, so navigation is not treated
    // as leaving unsaved changes.
    onSuccess: async ({ savedId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
        // A new private offer joins the options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
        queryClient.invalidateQueries({
          queryKey: simulationKeys.workspace(savedId),
        }),
      ]);
      if (simulationId === undefined) {
        // Load the new page's data first so it opens with its status.
        await queryClient.prefetchQuery(
          simulationWorkspaceQuery(fetchFn, savedId),
        );
        navigate(`/simulacoes/${savedId}`, { replace: true });
      }
    },
  });

  const remove = useMutation({
    retry: 0,
    mutationFn: () => deleteSimulation(fetchFn, simulationId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: simulationKeys.lists() });
      navigate('/simulacoes');
      // Dropped after leaving, so the page does not refetch a deleted record.
      queryClient.removeQueries({
        queryKey: simulationKeys.workspace(simulationId ?? ''),
      });
    },
  });

  const recalculate = useMutation({
    retry: 0,
    mutationFn: () => recalculateSimulation(fetchFn, simulationId ?? ''),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: simulationKeys.workspace(simulationId ?? ''),
      }),
  });

  // Rendered pending state lags a double click; these guards do not.
  const saving = useRef(false);
  const requesting = useRef(false);

  function run(
    values: SimulationFormValues,
    revision: number,
    callbacks: SaveCallbacks = {},
  ) {
    if (saving.current) return;
    saving.current = true;
    save.mutate(
      { values, revision },
      {
        onSuccess: (saved) => {
          if (simulationId !== undefined) {
            callbacks.onSaved?.(values, saved.revision);
          }
        },
        onError: (error) =>
          callbacks.onProblem?.(describeProblem(error, values.offerMode)),
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  }

  const problem: SaveProblem | null =
    !save.isPending && save.error
      ? describeProblem(
          save.error,
          save.variables?.values.offerMode ?? 'existing',
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
    if (!options.data || (sourceId !== null && !source.data)) {
      return { status: 'loading' } as const;
    }
    const saved = simulationId !== undefined ? (source.data ?? null) : null;
    const initialValues = source.data
      ? // A duplicate starts from the same offer, curve and investment.
        simulationValues(source.data.offer, source.data.simulation.investment)
      : blankSimulationValues(todayInSaoPaulo(), options.data);
    return {
      status: 'ready',
      loadGeneration,
      workspace: saved,
      initialValues,
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
    save: {
      run,
      pending: save.isPending,
      problem,
      // Loads the version saved elsewhere; the editor restarts from it.
      reload: async () => {
        save.reset();
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
