import Decimal from 'decimal.js';
import { InvestmentType, ValueObject } from '@investflow/shared-domain';
import { InvalidIndexerError } from '../../errors/product-domain.errors';

export class Indexer extends ValueObject<Indexer> {
  private constructor(
    readonly type: InvestmentType,
    readonly percentageOfIndex: Decimal | undefined,
    readonly spread: Decimal | undefined,
  ) {
    super();
  }

  static of(
    type: InvestmentType,
    percentageOfIndex?: Decimal | number | string,
    spread?: Decimal | number | string,
  ): Indexer {
    const pct = percentageOfIndex !== undefined ? new Decimal(percentageOfIndex) : undefined;
    const spd = spread !== undefined ? new Decimal(spread) : undefined;

    if (type === InvestmentType.SELIC) {
      if (pct !== undefined || spd !== undefined) {
        throw new InvalidIndexerError('SELIC does not accept a CDI percentage or spread');
      }
      return new Indexer(type, undefined, undefined);
    }

    if (type === InvestmentType.CDI) {
      if (pct === undefined || pct.lessThanOrEqualTo(0)) {
        throw new InvalidIndexerError('CDI requires a positive percentageOfIndex (e.g. 110 for 110% CDI)');
      }
      if (spd !== undefined) {
        throw new InvalidIndexerError('CDI does not accept a spread');
      }
      return new Indexer(type, pct, undefined);
    }

    // IPCA
    if (spd === undefined || spd.lessThanOrEqualTo(0)) {
      throw new InvalidIndexerError('IPCA requires a positive spread (e.g. 5.5 for IPCA + 5.5%)');
    }
    if (pct !== undefined) {
      throw new InvalidIndexerError('IPCA does not accept a percentageOfIndex');
    }
    return new Indexer(type, undefined, spd);
  }

  equals(other: Indexer): boolean {
    if (this.type !== other.type) return false;
    if (this.percentageOfIndex?.equals(other.percentageOfIndex ?? new Decimal(0)) === false) return false;
    if (this.spread?.equals(other.spread ?? new Decimal(0)) === false) return false;
    return true;
  }
}
