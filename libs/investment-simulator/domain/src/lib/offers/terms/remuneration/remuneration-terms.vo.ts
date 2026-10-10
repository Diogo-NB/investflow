import { Rate, ValueObject } from '@investflow/shared-domain';
import { EconomicIndex } from '../../../index-curves/economic-index.enum';

export type RemunerationKind =
  | 'PREFIXED'
  | 'IPCA_PLUS'
  | 'CDI_PERCENTAGE'
  | 'SELIC_PERCENTAGE';

export type RemunerationTerms =
  | PrefixedRemuneration
  | IndexPercentageRemuneration
  | IpcaPlusRemuneration;

abstract class RemunerationTermsBase extends ValueObject<RemunerationTerms> {
  abstract readonly kind: RemunerationKind;
  // The single contracted rate, whose meaning depends on the kind.
  abstract readonly contractRate: Rate;
  // Index whose curve the remuneration needs, or null when it needs none.
  abstract readonly requiredIndex: EconomicIndex | null;

  equals(other: RemunerationTerms): boolean {
    return (
      this.kind === other.kind && this.contractRate.equals(other.contractRate)
    );
  }
}

export class PrefixedRemuneration extends RemunerationTermsBase {
  readonly kind = 'PREFIXED';
  readonly requiredIndex = null;

  private constructor(readonly annualRate: Rate) {
    super();
  }

  static create(annualRate: Rate): PrefixedRemuneration {
    return new PrefixedRemuneration(annualRate);
  }

  get contractRate(): Rate {
    return this.annualRate;
  }
}

export class IndexPercentageRemuneration extends RemunerationTermsBase {
  private constructor(
    readonly kind: 'CDI_PERCENTAGE' | 'SELIC_PERCENTAGE',
    readonly percentage: Rate,
  ) {
    super();
  }

  static create(
    kind: 'CDI_PERCENTAGE' | 'SELIC_PERCENTAGE',
    percentage: Rate,
  ): IndexPercentageRemuneration {
    return new IndexPercentageRemuneration(kind, percentage);
  }

  get requiredIndex(): EconomicIndex.CDI | EconomicIndex.SELIC {
    return this.kind === 'CDI_PERCENTAGE'
      ? EconomicIndex.CDI
      : EconomicIndex.SELIC;
  }

  get contractRate(): Rate {
    return this.percentage;
  }
}

export class IpcaPlusRemuneration extends RemunerationTermsBase {
  readonly kind = 'IPCA_PLUS';
  readonly requiredIndex = EconomicIndex.IPCA;

  private constructor(readonly annualSpread: Rate) {
    super();
  }

  static create(annualSpread: Rate): IpcaPlusRemuneration {
    return new IpcaPlusRemuneration(annualSpread);
  }

  get contractRate(): Rate {
    return this.annualSpread;
  }
}

export const RemunerationTerms = {
  // Boundary factory: transport and persistence carry a kind and one rate.
  create(kind: RemunerationKind, rate: Rate): RemunerationTerms {
    switch (kind) {
      case 'PREFIXED':
        return PrefixedRemuneration.create(rate);
      case 'CDI_PERCENTAGE':
      case 'SELIC_PERCENTAGE':
        return IndexPercentageRemuneration.create(kind, rate);
      case 'IPCA_PLUS':
        return IpcaPlusRemuneration.create(rate);
    }
  },
};
