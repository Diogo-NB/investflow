import { METHODOLOGY_VERSION } from '@investflow/investment-simulator-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

export interface SimulationRunSummary {
  readonly id: string;
  readonly calculatedAt: string;
  readonly methodologyVersion: string;
  // True when recalculating now could differ: the application inputs changed
  // or the run predates the current methodology.
  readonly outdated: boolean;
  readonly inputs: {
    readonly offerSnapshotId: string;
    readonly indexCurveId: string | null;
    readonly principal: string;
    readonly investmentDate: string;
  };
  readonly maturitySummary: {
    readonly principal: string;
    readonly grossBalance: string;
    readonly grossEarnings: string;
    readonly iof: string;
    readonly incomeTax: string;
    readonly totalTaxes: string;
    readonly netBalance: string;
  };
}

export const runInputsSelect = {
  offerSnapshotId: true,
  indexCurveId: true,
  principal: true,
  investmentDate: true,
} satisfies Prisma.SimulationRunSelect & Prisma.InvestmentApplicationSelect;

export const runSummarySelect = {
  ...runInputsSelect,
  id: true,
  calculatedAt: true,
  methodologyVersion: true,
  grossBalance: true,
  grossEarnings: true,
  iof: true,
  incomeTax: true,
  totalTaxes: true,
  netBalance: true,
} satisfies Prisma.SimulationRunSelect;

type RunInputs = Prisma.SimulationRunGetPayload<{
  select: typeof runInputsSelect;
}>;

type RunSummaryRecord = Prisma.SimulationRunGetPayload<{
  select: typeof runSummarySelect;
}>;

function isOutdated(run: RunSummaryRecord, application: RunInputs): boolean {
  return (
    run.methodologyVersion !== METHODOLOGY_VERSION ||
    run.offerSnapshotId !== application.offerSnapshotId ||
    run.indexCurveId !== application.indexCurveId ||
    !run.principal.equals(application.principal) ||
    run.investmentDate.getTime() !== application.investmentDate.getTime()
  );
}

export function isoDate(value: Date): string {
  return CalendarDate.fromUtcDate(value).value.toIsoString();
}

export function toRunSummary(
  run: RunSummaryRecord,
  application: RunInputs,
): SimulationRunSummary {
  const principal = run.principal.toFixed();
  return {
    id: run.id,
    calculatedAt: run.calculatedAt.toISOString(),
    methodologyVersion: run.methodologyVersion,
    outdated: isOutdated(run, application),
    inputs: {
      offerSnapshotId: run.offerSnapshotId,
      indexCurveId: run.indexCurveId,
      principal,
      investmentDate: isoDate(run.investmentDate),
    },
    maturitySummary: {
      principal,
      grossBalance: run.grossBalance.toFixed(),
      grossEarnings: run.grossEarnings.toFixed(),
      iof: run.iof.toFixed(),
      incomeTax: run.incomeTax.toFixed(),
      totalTaxes: run.totalTaxes.toFixed(),
      netBalance: run.netBalance.toFixed(),
    },
  };
}
