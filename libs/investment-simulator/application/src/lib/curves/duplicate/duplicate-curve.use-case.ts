import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../curve-not-found.error';
import { CurveRepository } from '../curve.repository';
import { DuplicateCurveCommand } from './duplicate-curve.command';

export interface DuplicateCurveOutput {
  readonly curveId: string;
}

@Injectable()
export class DuplicateCurveUseCase
  implements CommandHandler<DuplicateCurveCommand, DuplicateCurveOutput>
{
  constructor(
    private readonly curveRepository: CurveRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: DuplicateCurveCommand,
  ): Promise<Result<DuplicateCurveOutput, AppError>> {
    const source = await this.curveRepository.findById(command.curveId);
    if (source.isErr()) return source;
    if (!source.value.isVisibleTo(command.actorId)) {
      return Result.err(new CurveNotFoundError(source.value.id));
    }

    const copy = source.value.duplicateFor(command.actorId, this.clock.now());
    if (copy.isErr()) return copy;
    const saved = await this.curveRepository.save(copy.value);
    return saved.map(() => ({ curveId: copy.value.id }));
  }
}
