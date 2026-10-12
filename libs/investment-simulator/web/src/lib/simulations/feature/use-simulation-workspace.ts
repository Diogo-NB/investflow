import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  createSimulation,
  deleteSimulation,
  editSimulation,
  simulationKeys,
  simulationOptionsQuery,
  simulationWorkspaceQuery,
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
  INVESTMENT_CURVE_COVERAGE_MISSING: 'curveId',
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
  onSaved?(values: SimulationFormValues): void;
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
  const source = useQuery({
    ...simulationWorkspaceQuery(fetchFn, sourceId ?? ''),
    enabled: sourceId !== null,
  });

  const save = useMutation({
    retry: 0,
    // A rejected request saves nothing, so the form keeps its edits.
    mutationFn: async (values: SimulationFormValues) => {
      const input = toSimulationInput(values);
      if (simulationId === undefined) {
        return (await createSimulation(fetchFn, input)).simulationId;
      }
      await editSimulation(fetchFn, simulationId, {
        ...input,
        revision: source.data?.simulation.revision ?? 0,
      });
      return simulationId;
    },
    // Runs while the mutation is still pending, so navigation is not treated
    // as leaving unsaved changes.
    onSuccess: async (savedId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
        // A new private offer joins the options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
        queryClient.invalidateQueries({
          queryKey: simulationKeys.workspace(savedId),
        }),
      ]);
      if (simulationId === undefined) {
        // Load the new page's data first so it opens with the result.
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

  // Rendered pending state lags a double click; this guard does not.
  const saving = useRef(false);

  function run(values: SimulationFormValues, callbacks: SaveCallbacks = {}) {
    if (saving.current) return;
    saving.current = true;
    save.mutate(values, {
      onSuccess: () => {
        if (simulationId !== undefined) callbacks.onSaved?.(values);
      },
      onError: (error) =>
        callbacks.onProblem?.(describeProblem(error, values.offerMode)),
      onSettled: () => {
        saving.current = false;
      },
    });
  }

  const problem: SaveProblem | null =
    !save.isPending && save.error
      ? describeProblem(save.error, save.variables?.offerMode ?? 'existing')
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
      reload: () => {
        save.reset();
        void source.refetch();
      },
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
