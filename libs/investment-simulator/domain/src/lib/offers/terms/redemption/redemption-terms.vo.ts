import { ValueObject } from '@investflow/shared-domain';

type RedemptionKind = 'AT_MATURITY' | 'DAILY';

export class RedemptionTerms extends ValueObject<RedemptionTerms> {
  private constructor(readonly kind: RedemptionKind) {
    super();
  }

  static create(kind: RedemptionKind): RedemptionTerms {
    return new RedemptionTerms(kind);
  }

  equals(other: RedemptionTerms): boolean {
    return this.kind === other.kind;
  }
}
