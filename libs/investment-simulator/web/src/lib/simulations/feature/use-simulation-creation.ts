import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { ApiError } from '../../http/api-error';
import {
  addInvestmentPlanSimulations,
  investmentPlanDetailQuery,
  investmentPlanKeys,
} from '../../investment-plans/api/investment-plan-api';
import { useApiFetch, useToasts } from '../../routes/investment-simulator-deps';
import {
  createSimulation,
  simulationKeys,
  simulationOptionsQuery,
  simulationWorkspaceQuery,
} from '../api/simulation-api';
import {
  blankSimulationValues,
  duplicateValues,
  toSimulationInput,
  type SimulationFormValues,
} from '../utils/simulation-form';
import {
  describeSaveProblem,
  type SaveProblem,
} from '../utils/simulation-save-problem';
import {
  useSimulationTermsSaving,
  type SimulationSaveCallbacks,
  type SimulationTermsSave,
} from './use-simulation-terms-saving';

export const TEMPLATE_PARAM = 'a-partir-de';
// The plan the user started from; the new simulation is offered to it.
export const INVESTMENT_PLAN_PARAM = 'plano';

export function useSimulationCreation() {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get(TEMPLATE_PARAM);
  const investmentPlanId = searchParams.get(INVESTMENT_PLAN_PARAM);
  const toasts = useToasts();
  const termsSaving = useSimulationTermsSaving();

  const options = useQuery(simulationOptionsQuery(fetchFn));
  const template = useQuery({
    ...simulationWorkspaceQuery(fetchFn, templateId ?? ''),
    enabled: templateId !== null,
  });
  // Read ahead for the offer after the create; the form never waits for it.
  useQuery({
    ...investmentPlanDetailQuery(fetchFn, investmentPlanId ?? ''),
    enabled: investmentPlanId !== null,
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
      await queryClient.invalidateQueries({ queryKey: simulationKeys.lists() });
      // Load the new page's data first so it opens with its status.
      await queryClient.prefetchQuery(
        simulationWorkspaceQuery(fetchFn, simulationId),
      );
      navigate(`/simulacoes/${simulationId}`, { replace: true });
    },
  });

  // Rendered pending state lags a double click; this guard does not.
  const creating = useRef(false);

  // Offered once the create has settled and this page has been replaced, so
  // whatever happens to the plan cannot report the simulation as unsaved.
  // A missing, deleted, or full plan gets no offer.
  async function offerInvestmentPlan(planId: string, simulationId: string) {
    const plan = await queryClient
      .ensureQueryData(investmentPlanDetailQuery(fetchFn, planId))
      .catch(() => null);
    if (!plan || plan.availableSimulationSlots === 0) return;
    let adding = false;
    const toastId = toasts.add({
      title: `Simulação criada. Adicionar ao plano ${plan.name}?`,
      actionProps: {
        children: 'Adicionar ao plano',
        onClick: () => {
          if (adding) return;
          adding = true;
          // Loading holds the toast open until the add answers.
          toasts.update(toastId, {
            type: 'loading',
            title: `Adicionando ao plano ${plan.name}…`,
            actionProps: undefined,
          });
          addInvestmentPlanSimulations(fetchFn, planId, [simulationId]).then(
            () => {
              void queryClient.invalidateQueries({
                queryKey: investmentPlanKeys.all,
              });
              void queryClient.invalidateQueries({
                queryKey: simulationKeys.lists(),
              });
              toasts.update(toastId, {
                type: 'success',
                title: `Adicionada ao plano ${plan.name}`,
                data: { link: { to: `/planos/${planId}`, label: 'Ver plano' } },
              });
            },
            (error: unknown) =>
              toasts.update(toastId, {
                type: 'error',
                title: `Não foi possível adicionar ao plano ${plan.name}`,
                description:
                  error instanceof ApiError && error.userMessage
                    ? error.userMessage
                    : 'Verifique sua conexão e use "Adicionar ao plano" na simulação.',
              }),
          );
        },
      },
    });
  }

  async function run(
    request: SimulationTermsSave,
    callbacks: SimulationSaveCallbacks,
  ) {
    if (creating.current) return;
    creating.current = true;
    create.reset();
    try {
      // The terms go first: the simulation's checks read them.
      const chosen = await termsSaving.save(request, callbacks);
      if (!chosen) return;
      // Not mutate's callbacks: React Query drops them once the navigation
      // unmounts this page, and this promise settles after onSuccess.
      await create.mutateAsync(chosen).then(
        ({ simulationId }) => {
          if (investmentPlanId !== null) {
            void offerInvestmentPlan(investmentPlanId, simulationId);
          }
        },
        (error: unknown) => {
          callbacks.onProblem(describeSaveProblem(error));
        },
      );
    } finally {
      creating.current = false;
    }
  }

  const problem: SaveProblem | null =
    termsSaving.problem ??
    (!create.isPending && create.error
      ? describeSaveProblem(create.error)
      : null);

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
        duplicateValues(template.data, options.data.remunerations)
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
    create: {
      run: (request: SimulationTermsSave, callbacks: SimulationSaveCallbacks) =>
        void run(request, callbacks),
      pending: termsSaving.pending || create.isPending,
      problem,
    },
  };
}
