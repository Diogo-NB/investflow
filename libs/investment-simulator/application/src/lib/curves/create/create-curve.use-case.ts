import { Injectable } from '@nestjs/common';
import { Curve } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveRepository } from '../curve.repository';
import { CreateCurveCommand } from './create-curve.command';

export interface CreateCurveOutput {
  readonly curveId: string;
}

@Injectable()
export class CreateCurveUseCase
  implements CommandHandler<CreateCurveCommand, CreateCurveOutput>
{
  constructor(
    private readonly curveRepository: CurveRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CreateCurveCommand,
  ): Promise<Result<CreateCurveOutput, AppError>> {
    const curve = Curve.create(
      {
        ownerId: command.actorId,
        index: command.index,
        name: command.name,
        description: command.description,
        intervals: command.intervals,
      },
      this.clock.now(),
    );
    if (curve.isErr()) return curve;

    const saved = await this.curveRepository.save(curve.value);
    return saved.map(() => ({ curveId: curve.value.id }));
  }
}
