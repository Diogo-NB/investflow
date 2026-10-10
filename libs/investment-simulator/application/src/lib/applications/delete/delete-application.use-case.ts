import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { ApplicationRepository } from '../application.repository';
import { findOwnedApplication } from '../shared/find-owned-application';
import { DeleteApplicationCommand } from './delete-application.command';

@Injectable()
export class DeleteApplicationUseCase
  implements CommandHandler<DeleteApplicationCommand, void>
{
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: DeleteApplicationCommand,
  ): Promise<Result<void, AppError>> {
    const application = await findOwnedApplication(
      this.applicationRepository,
      command.applicationId,
      command.ownerId,
    );
    if (application.isErr()) return application;

    return this.applicationRepository.save(
      application.value.delete(this.clock.now()),
    );
  }
}
