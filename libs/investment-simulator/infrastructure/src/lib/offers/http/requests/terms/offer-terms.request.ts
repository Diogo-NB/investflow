import {
  RedemptionTermsCommandInput,
  RemunerationTermsCommandInput,
} from '@investflow/investment-simulator-application';
import { IsIn, IsString } from 'class-validator';

const REDEMPTION_KINDS = ['AT_MATURITY', 'DAILY'] as const;
const REMUNERATION_KINDS = [
  'PREFIXED',
  'CDI_PERCENTAGE',
  'SELIC_PERCENTAGE',
  'IPCA_PLUS',
] as const;

export class RedemptionTermsRequest implements RedemptionTermsCommandInput {
  @IsIn(REDEMPTION_KINDS)
  kind!: RedemptionTermsCommandInput['kind'];
}

export class RemunerationTermsRequest implements RemunerationTermsCommandInput {
  @IsIn(REMUNERATION_KINDS)
  kind!: RemunerationTermsCommandInput['kind'];

  @IsString()
  rate!: string;
}
