import { Injectable } from '@nestjs/common';
import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveRepository } from '../curve.repository';
import {
  ApplyPublishedIndexValuesCommand,
  PublishedCurveIndex,
} from './apply-published-index-values.command';

// Other system curves of the same index may exist, so the name is part of the
// identity of the curve the Banco Central's values update.
const PUBLISHED_CURVE_NAMES: Readonly<Record<PublishedCurveIndex, string>> = {
  [EEconomicIndex.CDI]: 'CDI',
  [EEconomicIndex.SELIC]: 'SELIC',
};

@Injectable()
export class ApplyPublishedIndexValuesUseCase
  implements CommandHandler<ApplyPublishedIndexValuesCommand, void>
{
  constructor(
    private readonly curveRepository: CurveRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ApplyPublishedIndexValuesCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.curveRepository.findSystemCurve(
      command.index,
      PUBLISHED_CURVE_NAMES[command.index],
    );
    if (found.isErr()) return found;

    const applied = found.value.applyPublishedValues(
      command.values,
      this.clock.now(),
    );
    if (applied.isErr()) return applied;
    return this.curveRepository.save(found.value);
  }
}
