import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  calculateSimulation,
  createSimulation,
  deleteSimulation,
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
import { CALCULATION_PARAM } from './use-calculation-history';

export const TEMPLATE_PARAM = 'a-partir-de';

export interface CalculationProblem {
  readonly message: string;
  // The input the user should change, when one is responsible.
  readonly field: SimulationField | null;
}

// The API explains the failure; the form only needs to know where to point.
const FIELD_BY_CODE: Readonly<Record<string, SimulationField>> = {
  INVESTMENT_CURVE_REQUIRED: 'indexCurveId',
  INVESTMENT_CURVE_INCOMPATIBLE: 'indexCurveId',
  INVESTMENT_CURVE_UNAVAILABLE: 'indexCurveId',
  INVESTMENT_CURVE_COVERAGE_MISSING: 'indexCurveId',
  INDEX_CURVE_NOT_FOUND: 'indexCurveId',
  INVESTMENT_PERIOD_INVALID: 'maturityDate',
  INVESTMENT_PRINCIPAL_INVALID: 'principal',
  INVESTMENT_REMUNERATION_UNSUPPORTED: 'remunerationKind',
};

function problemField(error: ApiError): SimulationField | null {
  if (error.code === 'INVESTMENT_DATE_NOT_BUSINESS_DAY') {
    return error.details['field'] === 'maturityDate'
      ? 'maturityDate'
      : 'investmentDate';
  }
  return (error.code && FIELD_BY_CODE[error.code]) || null;
}

function describeProblem(error: unknown): CalculationProblem {
  if (!(error instanceof ApiError)) {
    return {
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      field: null,
    };
  }
  return {
    message:
      error.userMessage ?? 'Não foi possível concluir agora. Tente novamente.',
    field: problemField(error),
  };
}

export interface CalculateCallbacks {
  onSaved?(values: SimulationFormValues): void;
  onProblem?(problem: CalculationProblem): void;
}

export function useSimulationWorkspace(simulationId: string | undefined) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateId =
    simulationId === undefined ? searchParams.get(TEMPLATE_PARAM) : null;
  const sourceId = simulationId ?? templateId;

  const options = useQuery(simulationOptionsQuery(fetchFn));
  const source = useQuery({
    ...simulationWorkspaceQuery(fetchFn, sourceId ?? ''),
    enabled: sourceId !== null,
  });

  const calculate = useMutation({
    retry: 0,
    // A rejected calculation saves nothing, so the form keeps its edits.
    mutationFn: (values: SimulationFormValues) => {
      const input = toSimulationInput(values);
      return simulationId === undefined
        ? createSimulation(fetchFn, input)
        : calculateSimulation(fetchFn, simulationId, input.investment);
    },
    // Runs while the mutation is still pending, so navigation is not treated
    // as leaving unsaved changes.
    onSuccess: async (calculated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: simulationKeys.workspace(calculated.simulationId),
        }),
      ]);
      if (simulationId === undefined) {
        // Load the new page's data first so it opens with the result.
        await queryClient.prefetchQuery(
          simulationWorkspaceQuery(fetchFn, calculated.simulationId),
        );
        navigate(`/simulacoes/${calculated.simulationId}`, { replace: true });
        return;
      }
      // Show the new latest calculation instead of a selected older one.
      setSearchParams(
        (current) => {
          current.delete(CALCULATION_PARAM);
          return current;
        },
        { replace: true, preventScrollReset: true },
      );
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
  const calculating = useRef(false);

  function run(
    values: SimulationFormValues,
    callbacks: CalculateCallbacks = {},
  ) {
    if (calculating.current) return;
    calculating.current = true;
    calculate.mutate(values, {
      onSuccess: () => {
        if (simulationId !== undefined) callbacks.onSaved?.(values);
      },
      onError: (error) => callbacks.onProblem?.(describeProblem(error)),
      onSettled: () => {
        calculating.current = false;
      },
    });
  }

  const problem: CalculationProblem | null =
    !calculate.isPending && calculate.error
      ? describeProblem(calculate.error)
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
    const current = source.data?.calculations[0];
    const initialValues =
      source.data && current
        ? // A duplicate also starts here, then saves as custom terms.
          simulationValues(source.data.simulation.terms, current.investment)
        : blankSimulationValues(todayInSaoPaulo(), options.data);
    return {
      status: 'ready',
      simulation: saved?.simulation ?? null,
      calculations: saved?.calculations ?? [],
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
    calculate: { run, pending: calculate.isPending, problem },
    remove: {
      run: () => {
        if (!remove.isPending) remove.mutate();
      },
      pending: remove.isPending,
      failed: remove.isError,
    },
  };
}
