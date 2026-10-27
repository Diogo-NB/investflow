import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  createSimulation,
  simulationKeys,
  simulationOptionsQuery,
  simulationWorkspaceQuery,
} from '../api/simulation-api';
import {
  blankSimulationValues,
  simulationValues,
  toSimulationInput,
  type SimulationFormValues,
} from '../utils/simulation-form';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';

export const TEMPLATE_PARAM = 'a-partir-de';

export function useSimulationCreation() {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get(TEMPLATE_PARAM);

  const options = useQuery(simulationOptionsQuery(fetchFn));
  const template = useQuery({
    ...simulationWorkspaceQuery(fetchFn, templateId ?? ''),
    enabled: templateId !== null,
  });

  const create = useMutation({
    retry: 0,
    mutationFn: (values: SimulationFormValues) =>
      createSimulation(fetchFn, toSimulationInput(values)),
    // Runs while the mutation is still pending, so the unsaved-changes guard
    // lets the navigation through. Only steps that cannot fail belong here:
    // a failure would report the committed simulation as unsaved and invite
    // a duplicate.
    onSuccess: async ({ simulationId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: simulationKeys.lists() }),
        // A new private offer joins the options.
        queryClient.invalidateQueries({ queryKey: simulationKeys.options() }),
      ]);
      // Load the new page's data first so it opens with its status.
      await queryClient.prefetchQuery(
        simulationWorkspaceQuery(fetchFn, simulationId),
      );
      navigate(`/simulacoes/${simulationId}`, { replace: true });
    },
  });

  // Rendered pending state lags a double click; this guard does not.
  const creating = useRef(false);

  function run(
    values: SimulationFormValues,
    onProblem: (problem: SaveProblem) => void,
  ) {
    if (creating.current) return;
    creating.current = true;
    create.mutate(values, {
      onError: (error) =>
        onProblem(describeSaveProblem(error, values.offerMode)),
      onSettled: () => {
        creating.current = false;
      },
    });
  }

  const problem: SaveProblem | null =
    !create.isPending && create.error
      ? describeSaveProblem(
          create.error,
          create.variables?.offerMode ?? 'existing',
        )
      : null;

  const setup = (() => {
    if (options.isError || template.isError) {
      const missing =
        template.error instanceof ApiError && template.error.status === 404;
      return missing
        ? ({ status: 'missing' } as const)
        : ({ status: 'error' } as const);
    }
    if (!options.data || (templateId !== null && !template.data)) {
      return { status: 'loading' } as const;
    }
    const initialValues = template.data
      ? // A duplicate starts from the same offer, curve and investment.
        simulationValues(
          template.data.offer,
          template.data.simulation.investment,
        )
      : blankSimulationValues(todayInSaoPaulo(), options.data);
    return {
      status: 'ready',
      templateId,
      initialValues,
      options: options.data,
    } as const;
  })();

  return {
    setup,
    retrySetup: () => {
      for (const query of [options, template]) {
        if (query.isError) void query.refetch();
      }
    },
    create: { run, pending: create.isPending, problem },
  };
}
