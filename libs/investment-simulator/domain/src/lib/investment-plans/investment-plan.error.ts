import {
  AppErrorMetadata,
  ConflictError,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class InvalidInvestmentPlanError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(reason, { code: EAppErrorCode.INVESTMENT_PLAN_INVALID, metadata });
  }
}

export class InvestmentPlanRevisionConflictError extends ConflictError {
  constructor(id: string, expectedRevision: number) {
    super(
      'Estes dados foram alterados em outro lugar. Recarregue e tente novamente.',
      {
        code: EAppErrorCode.INVESTMENT_PLAN_REVISION_CONFLICT,
        metadata: { id, expectedRevision },
      },
    );
  }
}

export class InvestmentPlanSimulationLimitError extends ConflictError {
  constructor(id: string, limit: number, availableSlots: number) {
    super(
      availableSlots === 0
        ? `O plano já tem ${limit} simulações, o máximo permitido.`
        : `Um plano tem no máximo ${limit} simulações; ainda cabem ${availableSlots}.`,
      {
        code: EAppErrorCode.INVESTMENT_PLAN_SIMULATION_LIMIT,
        metadata: { id, limit, availableSlots },
      },
    );
  }
}
