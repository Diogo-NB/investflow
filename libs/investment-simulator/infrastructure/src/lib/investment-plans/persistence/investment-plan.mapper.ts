import { InvestmentPlan } from '@investflow/investment-simulator-domain';
import { UtcInstant } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

// A soft-deleted simulation leaves its plans here, without a write.
export const investmentPlanInclude = {
  simulations: {
    where: { simulation: { deletedAt: null } },
    select: { simulationId: true },
  },
} satisfies Prisma.InvestmentPlanInclude;

export type InvestmentPlanRecord = Prisma.InvestmentPlanGetPayload<{
  include: typeof investmentPlanInclude;
}>;

export class InvestmentPlanMapper {
  static toDomain(record: InvestmentPlanRecord): InvestmentPlan {
    return InvestmentPlan.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      name: record.name,
      description: record.description,
      revision: record.revision,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
      simulationIds: record.simulations.map(({ simulationId }) => simulationId),
    });
  }

  static toPersistence(
    plan: InvestmentPlan,
  ): Prisma.InvestmentPlanUncheckedCreateWithoutSimulationsInput {
    return {
      id: plan.id,
      ownerId: plan.ownerId,
      name: plan.name,
      description: plan.description,
      revision: plan.revision,
      deletedAt: plan.deletedAt?.date ?? null,
    };
  }
}
