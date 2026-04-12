import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { InvestmentType, RateReferenceType } from '@investflow/shared-domain';

@ValidatorConstraint({ name: 'IndexerCombination', async: false })
class IndexerCombinationConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateProductDto;
    const { indexerType, indexerPercentageOfIndex, indexerSpread } = dto;

    if (indexerType === InvestmentType.SELIC) {
      return indexerPercentageOfIndex === undefined && indexerSpread === undefined;
    }
    if (indexerType === InvestmentType.CDI) {
      return indexerPercentageOfIndex !== undefined && indexerSpread === undefined;
    }
    if (indexerType === InvestmentType.IPCA) {
      return indexerSpread !== undefined && indexerPercentageOfIndex === undefined;
    }
    return false;
  }

  defaultMessage(): string {
    return (
      'Invalid indexer combination. ' +
      'SELIC: no percentageOfIndex or spread. ' +
      'CDI: requires percentageOfIndex, no spread. ' +
      'IPCA: requires spread, no percentageOfIndex.'
    );
  }
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(InvestmentType)
  type!: InvestmentType;

  @IsEnum(InvestmentType)
  @Validate(IndexerCombinationConstraint)
  indexerType!: InvestmentType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  indexerPercentageOfIndex?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  indexerSpread?: number;

  @IsNumber()
  @IsPositive()
  rateValue!: number;

  @IsEnum(RateReferenceType)
  rateReferenceType!: RateReferenceType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @IsPositive()
  minimumAmount!: number;

  @IsNumber()
  @IsPositive()
  totalVolume!: number;
}
