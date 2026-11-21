import {
  ComparedSimulationReader,
  InvestmentPlanMemberReader,
  SimulationResultValidityReader,
} from '@investflow/investment-simulator-application';
import {
  ComparedSimulation,
  ESimulationCalculationStatus,
  InvestmentPlanMember,
  SimulationResultValidity,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  InputFingerprint,
  Money,
  Result,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import Decimal from 'decimal.js';
import { InvestmentPlanQueryError } from '../../investment-plans/queries/investment-plan-query.error';
import { SimulationComparisonQueryError } from '../../simulation-comparisons/queries/simulation-comparison-query.error';
import { SimulationQueryError } from '../../simulations/queries/simulation-query.error';
import { PremiseCopyRevisions } from './premise-copy-revisions';

// The three readers that compare a result with its current premises, as
// their production versions do, but with the copy's revisions under V2 and
// V3, and without reading the offer or curve tables.

const premiseIdsSelect = {
  revision: true,
  offerId: true,
  curveId: true,
} as const;

function calculationStatusOf(
  id: string,
  calculation: { status: string } | null,
): ESimulationCalculationStatus {
  if (!calculation)
    throw new Error(`Simulation ${id} without a calculation row`);
  return calculation.status as ESimulationCalculationStatus;
}

export class PremiseCopySimulationResultValidityReader
  implements SimulationResultValidityReader
{
  constructor(private readonly prisma: PrismaService) {}

  findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<
    Result<ReadonlyMap<string, SimulationResultValidity>, SimulationQueryError>
  > {
    return Result.fromPromise(
      async () => {
        const client = this.prisma.client;
        const records = await client.simulation.findMany({
          where: { id: { in: [...simulationIds] }, ownerId, deletedAt: null },
          select: {
            id: true,
            ...premiseIdsSelect,
            calculation: { select: { status: true } },
            result: { select: { inputFingerprint: true } },
          },
        });
        const copies = await PremiseCopyRevisions.load(client, records);
        return new Map(
          records.map((record) => [
            record.id,
            SimulationResultValidity.create({
              calculationStatus: calculationStatusOf(
                record.id,
                record.calculation,
              ),
              currentInputFingerprint: copies.currentInputFingerprintOf(record),
              resultInputFingerprint: record.result
                ? InputFingerprint.restore(record.result.inputFingerprint)
                : null,
            }),
          ]),
        );
      },
      (cause) => new SimulationQueryError(cause),
    );
  }
}

export class PremiseCopyComparedSimulationReader
  implements ComparedSimulationReader
{
  constructor(private readonly prisma: PrismaService) {}

  findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<
    Result<
      ReadonlyMap<string, ComparedSimulation>,
      SimulationComparisonQueryError
    >
  > {
    return Result.fromPromise(
      async () => {
        const client = this.prisma.client;
        const records = await client.simulation.findMany({
          where: { id: { in: [...simulationIds] }, ownerId, deletedAt: null },
          select: {
            id: true,
            ...premiseIdsSelect,
            calculation: { select: { status: true } },
            result: {
              select: {
                inputFingerprint: true,
                principal: true,
                investmentDate: true,
                maturityDate: true,
                netBalance: true,
                netAnnualReturn: true,
              },
            },
          },
        });
        const copies = await PremiseCopyRevisions.load(client, records);
        return new Map(
          records.map(({ result, ...record }) => [
            record.id,
            ComparedSimulation.create({
              id: record.id,
              calculationStatus: calculationStatusOf(
                record.id,
                record.calculation,
              ),
              currentInputFingerprint: copies.currentInputFingerprintOf(record),
              lastResult: result && {
                inputFingerprint: InputFingerprint.restore(
                  result.inputFingerprint,
                ),
                principal: Money.of(result.principal.toFixed()),
                investmentDate: CalendarDate.fromUtcDate(result.investmentDate)
                  .value,
                maturityDate: CalendarDate.fromUtcDate(result.maturityDate)
                  .value,
                netFinalBalance: Money.of(result.netBalance.toFixed()),
                netAnnualReturn: new Decimal(result.netAnnualReturn.toFixed()),
              },
            }),
          ]),
        );
      },
      (cause) => new SimulationComparisonQueryError(cause),
    );
  }
}

export class PremiseCopyInvestmentPlanMemberReader
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
        const client = this.prisma.client;
        const plans = await client.investmentPlan.findMany({
          where: {
            id: { in: [...investmentPlanIds] },
            ownerId,
            deletedAt: null,
          },
          select: {
            id: true,
            simulations: {
              where: { simulation: { deletedAt: null } },
              select: {
                simulation: {
                  select: {
                    id: true,
                    ...premiseIdsSelect,
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
              },
            },
          },
        });
        const copies = await PremiseCopyRevisions.load(
          client,
          plans.flatMap(({ simulations }) =>
            simulations.map(({ simulation }) => simulation),
          ),
        );
        return new Map(
          plans.map(({ id, simulations }) => [
            id,
            simulations.map(({ simulation: { result, ...simulation } }) =>
              InvestmentPlanMember.create({
                calculationStatus: calculationStatusOf(
                  simulation.id,
                  simulation.calculation,
                ),
                currentInputFingerprint:
                  copies.currentInputFingerprintOf(simulation),
                redemptionTerms: copies.redemptionTermsOf(simulation.offerId),
                lastResult: result && {
                  inputFingerprint: InputFingerprint.restore(
                    result.inputFingerprint,
                  ),
                  principal: Money.of(result.principal.toFixed()),
                  iof: Money.of(result.iof.toFixed()),
                  incomeTax: Money.of(result.incomeTax.toFixed()),
                  netFinalBalance: Money.of(result.netBalance.toFixed()),
                  investmentDate: CalendarDate.fromUtcDate(
                    result.investmentDate,
                  ).value,
                  maturityDate: CalendarDate.fromUtcDate(result.maturityDate)
                    .value,
                },
              }),
            ),
          ]),
        );
      },
      (cause) => new InvestmentPlanQueryError(cause),
    );
  }
}
