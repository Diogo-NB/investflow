import { Injectable } from '@nestjs/common';
import { CurveReadOnlyError } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../curve-not-found.error';
import { CurveRepository } from '../curve.repository';
import { DeleteCurveCommand } from './delete-curve.command';

@Injectable()
export class DeleteCurveUseCase
  implements CommandHandler<DeleteCurveCommand, void>
{
  constructor(
    private readonly curveRepository: CurveRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: DeleteCurveCommand): Promise<Result<void, AppError>> {
    const found = await this.curveRepository.findById(command.curveId);
    if (found.isErr()) return found;
    const curve = found.value;
    if (!curve.isVisibleTo(command.actorId)) {
      return Result.err(new CurveNotFoundError(curve.id));
    }
    if (!curve.canBeChangedBy(command.actorId)) {
      return Result.err(new CurveReadOnlyError(curve.id));
    }
    return this.curveRepository.save(curve.delete(this.clock.now()));
  }
}
