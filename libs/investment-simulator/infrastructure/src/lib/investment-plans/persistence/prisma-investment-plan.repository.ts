import {
  InvestmentPlanNotFoundError,
  InvestmentPlanRepository,
} from '@investflow/investment-simulator-application';
import {
  InvestmentPlan,
  InvestmentPlanRevisionConflictError,
} from '@investflow/investment-simulator-domain';
import { DomainEventRecorder, Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  investmentPlanInclude,
  InvestmentPlanMapper,
} from './investment-plan.mapper';

@Injectable()
export class PrismaInvestmentPlanRepository
  extends BaseRepository<InvestmentPlan>
  implements InvestmentPlanRepository
{
  // What each aggregate had when it was read or last saved; a plan without a
  // revision is new.
  private readonly storedRevisions = new WeakMap<InvestmentPlan, number>();
  private readonly storedSimulationIds = new WeakMap<
    InvestmentPlan,
    ReadonlySet<string>
  >();

  constructor(prisma: PrismaService, events: DomainEventRecorder) {
    super(prisma, events);
  }

  findById(
    id: string,
  ): Promise<
    Result<InvestmentPlan, InvestmentPlanNotFoundError | RepositoryFindError>
  > {
    return this.find(id, {});
  }

  findOwned(
    id: string,
    ownerId: string,
  ): Promise<
    Result<InvestmentPlan, InvestmentPlanNotFoundError | RepositoryFindError>
  > {
    return this.find(id, { ownerId });
  }

  // Every change raises the revision, so two concurrent adds conflict on the
  // plan row instead of passing the limit together.
  protected async persistAggregate(
    plan: InvestmentPlan,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedRevisions.get(plan);
    if (stored === plan.revision) return;

    const data = InvestmentPlanMapper.toPersistence(plan);
    if (stored === undefined) {
      await client.investmentPlan.create({ data });
    } else {
      const { count } = await client.investmentPlan.updateMany({
        where: { id: plan.id, revision: stored },
        data,
      });
      if (count === 0) {
        throw new InvestmentPlanRevisionConflictError(plan.id, stored);
      }
    }

    const before = this.storedSimulationIds.get(plan) ?? new Set<string>();
    const after = new Set(plan.simulationIds);
    const removed = [...before].filter((id) => !after.has(id));
    const added = [...after].filter((id) => !before.has(id));
    if (removed.length) {
      await client.investmentPlanSimulation.deleteMany({
        where: { investmentPlanId: plan.id, simulationId: { in: removed } },
      });
    }
    if (added.length) {
      await client.investmentPlanSimulation.createMany({
        data: added.map((simulationId) => ({
          investmentPlanId: plan.id,
          simulationId,
        })),
        skipDuplicates: true,
      });
    }
    this.remember(plan);
  }

  private async find(
    id: string,
    scope: Prisma.InvestmentPlanWhereInput,
  ): Promise<
    Result<InvestmentPlan, InvestmentPlanNotFoundError | RepositoryFindError>
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentPlan.findFirst({
          where: { ...scope, id, deletedAt: null },
          include: investmentPlanInclude,
        });
        return record ? InvestmentPlanMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('InvestmentPlan', id, error),
    );
    if (result.isErr()) return result;
    if (!result.value) return Result.err(new InvestmentPlanNotFoundError(id));
    this.remember(result.value);
    return Result.ok(result.value);
  }

  private remember(plan: InvestmentPlan): void {
    this.storedRevisions.set(plan, plan.revision);
    this.storedSimulationIds.set(plan, new Set(plan.simulationIds));
  }
}
