import { z } from 'zod';
import type {
  InvestmentPlanDetail,
  InvestmentPlanEdit,
  InvestmentPlanInput,
} from '../models/investment-plan.types';

export interface InvestmentPlanFormValues {
  name: string;
  // Blank when the plan has no description.
  description: string;
}

export const investmentPlanFormSchema = z.object({
  name: z
    .string()
    .refine((value) => value.trim() !== '', 'Informe o nome do plano.')
    .refine((value) => value.length <= 100, 'Use até 100 caracteres.'),
  description: z.string().max(500, 'Use até 500 caracteres.'),
});

export function blankInvestmentPlanValues(): InvestmentPlanFormValues {
  return { name: '', description: '' };
}

export function investmentPlanValues(
  plan: InvestmentPlanDetail,
): InvestmentPlanFormValues {
  return { name: plan.name, description: plan.description ?? '' };
}

export function toInvestmentPlanInput(
  values: InvestmentPlanFormValues,
): InvestmentPlanInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
  };
}

/** The fields that differ from the plan the editor started from. */
export function investmentPlanEdit(
  baseline: InvestmentPlanDetail,
  values: InvestmentPlanFormValues,
): InvestmentPlanEdit {
  const before = toInvestmentPlanInput(investmentPlanValues(baseline));
  const after = toInvestmentPlanInput(values);
  return {
    revision: baseline.revision,
    ...(after.name !== before.name ? { name: after.name } : {}),
    ...(after.description !== before.description
      ? { description: after.description }
      : {}),
  };
}
