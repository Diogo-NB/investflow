import { CalendarDate, ValueObject } from '@investflow/shared-domain';
import { ETitleType } from '../title-type.enum';
import { RedemptionTerms } from './redemption/redemption-terms.vo';
import { RemunerationTerms } from './remuneration/remuneration-terms.vo';

export interface InvestmentTermsProps {
  readonly titleType: ETitleType;
  readonly issuerId: string | null;
  readonly maturityDate: CalendarDate;
  readonly redemption: RedemptionTerms;
  readonly remuneration: RemunerationTerms;
}

export class InvestmentTerms extends ValueObject<InvestmentTerms> {
  private constructor(private readonly props: InvestmentTermsProps) {
    super();
  }

  static create(props: InvestmentTermsProps): InvestmentTerms {
    return new InvestmentTerms({ ...props });
  }

  get titleType(): ETitleType {
    return this.props.titleType;
  }

  get issuerId(): string | null {
    return this.props.issuerId;
  }

  get maturityDate(): CalendarDate {
    return this.props.maturityDate;
  }

  get redemption(): RedemptionTerms {
    return this.props.redemption;
  }

  get remuneration(): RemunerationTerms {
    return this.props.remuneration;
  }

  equals(other: InvestmentTerms): boolean {
    return (
      this.titleType === other.titleType &&
      this.issuerId === other.issuerId &&
      this.maturityDate.equals(other.maturityDate) &&
      this.redemption.equals(other.redemption) &&
      this.remuneration.equals(other.remuneration)
    );
  }
}
