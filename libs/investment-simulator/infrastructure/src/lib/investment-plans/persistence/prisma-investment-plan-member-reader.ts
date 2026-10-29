import { Injectable } from '@nestjs/common';
import { InvestmentPlanMemberReader } from '@investflow/investment-simulator-application';
import {
  ESimulationCalculationStatus,
  ETitleType,
  InvestmentPlanMember,
  RedemptionTerms,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  InputFingerprint,
  Money,
  Result,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { InvestmentPlanQueryError } from '../queries/investment-plan-query.error';

const memberSelect = {
  simulation: {
    select: {
      revision: true,
      offer: {
        select: { titleType: true, termsRevision: true, redemptionType: true },
      },
      curve: { select: { valuesRevision: true } },
      calculation: { select: { status: true } },
      result: {
        select: {
          inputFingerprint: true,
          principal: true,
          iof: true,
          incomeTax: true,
          netBalance: true,
          investmentDate: true,
          maturityDate: true,
        },
      },
    },
  },
} satisfies Prisma.InvestmentPlanSimulationSelect;

type MemberRecord = Prisma.InvestmentPlanSimulationGetPayload<{
  select: typeof memberSelect;
}>;

// Reads at most the plans asked for × InvestmentPlan.SIMULATION_LIMIT rows.
@Injectable()
export class PrismaInvestmentPlanMemberReader
  implements InvestmentPlanMemberReader
{
  constructor(private readonly prisma: PrismaService) {}

  findByPlans(
    ownerId: string,
    investmentPlanIds: readonly string[],
  ): Promise<
    Result<
      ReadonlyMap<string, readonly InvestmentPlanMember[]>,
      InvestmentPlanQueryError
    >
  > {
    return Result.fromPromise(
      async () => {
        const plans = await this.prisma.client.investmentPlan.findMany({
          where: {
            id: { in: [...investmentPlanIds] },
            ownerId,
            deletedAt: null,
          },
          select: {
            id: true,
            simulations: {
              where: { simulation: { deletedAt: null } },
              select: memberSelect,
            },
          },
        });
        return new Map(
          plans.map(({ id, simulations }) => [
            id,
            simulations.map((record) => this.toDomain(record)),
          ]),
        );
      },
      (cause) => new InvestmentPlanQueryError(cause),
    );
  }

  private toDomain({ simulation }: MemberRecord): InvestmentPlanMember {
    const { offer, curve, calculation, result } = simulation;
    if (!calculation) {
      throw new Error('A plan member without a calculation row');
    }
    return InvestmentPlanMember.create({
      calculationStatus: calculation.status as ESimulationCalculationStatus,
      currentInputFingerprint: SimulationResult.inputFingerprintFor({
        simulationRevision: simulation.revision,
        offer: {
          titleType: offer.titleType as ETitleType,
          termsRevision: offer.termsRevision,
        },
        curveValuesRevision: curve?.valuesRevision ?? null,
      }),
      redemptionTerms: RedemptionTerms.create(offer.redemptionType),
      lastResult: result && {
        inputFingerprint: InputFingerprint.restore(result.inputFingerprint),
        principal: Money.of(result.principal.toFixed()),
        iof: Money.of(result.iof.toFixed()),
        incomeTax: Money.of(result.incomeTax.toFixed()),
        netFinalBalance: Money.of(result.netBalance.toFixed()),
        investmentDate: CalendarDate.fromUtcDate(result.investmentDate).value,
        maturityDate: CalendarDate.fromUtcDate(result.maturityDate).value,
      },
    });
  }
}
