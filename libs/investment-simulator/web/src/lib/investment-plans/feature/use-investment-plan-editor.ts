import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../http/api-error';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import {
  createInvestmentPlan,
  editInvestmentPlan,
  investmentPlanDetailQuery,
  investmentPlanKeys,
} from '../api/investment-plan-api';
import type { InvestmentPlanDetail } from '../models/investment-plan.types';
import {
  blankInvestmentPlanValues,
  investmentPlanEdit,
  investmentPlanValues,
  toInvestmentPlanInput,
  type InvestmentPlanFormValues,
} from '../utils/investment-plan-form';

export interface InvestmentPlanSaveProblem {
  readonly message: string;
  // The plan changed elsewhere; reloading shows the saved version.
  readonly conflict: boolean;
}

function describeProblem(error: unknown): InvestmentPlanSaveProblem {
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
    conflict: error.code === 'INVESTMENT_PLAN_REVISION_CONFLICT',
  };
}

interface EditRequest {
  readonly baseline: InvestmentPlanDetail;
  readonly values: InvestmentPlanFormValues;
}

export function useInvestmentPlanEditor(investmentPlanId: string | undefined) {
  const fetchFn = useApiFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const detail = useQuery({
    ...investmentPlanDetailQuery(fetchFn, investmentPlanId ?? ''),
    enabled: investmentPlanId !== undefined,
  });
  // Bumped after a reload so the editor restarts from the version read.
  const [loadGeneration, setLoadGeneration] = useState(0);

  // Both run their follow-up while still pending, so the unsaved-changes
  // guard lets the navigation through. Only steps that cannot fail belong
  // there: a failure would report the saved plan as unsaved.
  const create = useMutation({
    retry: 0,
    mutationFn: (values: InvestmentPlanFormValues) =>
      createInvestmentPlan(fetchFn, toInvestmentPlanInput(values)),
    onSuccess: async ({ investmentPlanId: createdId }) => {
      await queryClient.invalidateQueries({
        queryKey: investmentPlanKeys.lists(),
      });
      navigate(`/planos/${createdId}`, { replace: true });
    },
  });
  const edit = useMutation({
    retry: 0,
    mutationFn: ({ baseline, values }: EditRequest) =>
      editInvestmentPlan(
        fetchFn,
        baseline.id,
        investmentPlanEdit(baseline, values),
      ),
    onSuccess: async (_, { baseline }) => {
      await queryClient.invalidateQueries({
        queryKey: investmentPlanKeys.all,
      });
      navigate(`/planos/${baseline.id}`);
    },
  });
  const mutation = investmentPlanId === undefined ? create : edit;

  // Rendered pending state lags a double click; this guard does not.
  const saving = useRef(false);
  const settle = {
    onSettled: () => {
      saving.current = false;
    },
  };

  const setup = (() => {
    if (investmentPlanId === undefined) {
      return {
        status: 'ready',
        plan: null,
        initialValues: blankInvestmentPlanValues(),
        loadGeneration,
      } as const;
    }
    if (detail.data) {
      return {
        status: 'ready',
        plan: detail.data,
        initialValues: investmentPlanValues(detail.data),
        loadGeneration,
      } as const;
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
    retrySetup: () => void detail.refetch(),
    save: {
      create: (values: InvestmentPlanFormValues) => {
        if (saving.current) return;
        saving.current = true;
        create.mutate(values, settle);
      },
      edit: (
        baseline: InvestmentPlanDetail,
        values: InvestmentPlanFormValues,
      ) => {
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
