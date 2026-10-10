import { Rate, ValueObject } from '@investflow/shared-domain';

export type RemunerationKind =
  | 'PREFIXED'
  | 'IPCA_PLUS'
  | 'CDI_PERCENTAGE'
  | 'SELIC_PERCENTAGE';

export class RemunerationTerms extends ValueObject<RemunerationTerms> {
  private constructor(
    readonly kind: RemunerationKind,
    readonly rate: Rate,
  ) {
    super();
  }

  static create(kind: RemunerationKind, rate: Rate): RemunerationTerms {
    return new RemunerationTerms(kind, rate);
  }

  equals(other: RemunerationTerms): boolean {
    return this.kind === other.kind && this.rate.equals(other.rate);
  }
}
