import { InvestmentType, RateReferenceType } from '@investflow/shared-domain';

export interface CreateProductCommandProps {
  organizationId: string;
  name: string;
  type: InvestmentType;
  indexerType: InvestmentType;
  indexerPercentageOfIndex?: number;
  indexerSpread?: number;
  rateValue: number;
  rateReferenceType: RateReferenceType;
  startDate: Date;
  endDate: Date;
  minimumAmount: number;
  totalVolume: number;
}

export class CreateProductCommand {
  readonly organizationId: string;
  readonly name: string;
  readonly type: InvestmentType;
  readonly indexerType: InvestmentType;
  readonly indexerPercentageOfIndex: number | undefined;
  readonly indexerSpread: number | undefined;
  readonly rateValue: number;
  readonly rateReferenceType: RateReferenceType;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly minimumAmount: number;
  readonly totalVolume: number;

  constructor(props: CreateProductCommandProps) {
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.type = props.type;
    this.indexerType = props.indexerType;
    this.indexerPercentageOfIndex = props.indexerPercentageOfIndex;
    this.indexerSpread = props.indexerSpread;
    this.rateValue = props.rateValue;
    this.rateReferenceType = props.rateReferenceType;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.minimumAmount = props.minimumAmount;
    this.totalVolume = props.totalVolume;
  }
}
