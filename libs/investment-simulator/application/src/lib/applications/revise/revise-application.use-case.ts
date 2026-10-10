import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { findOptionalIndexCurve } from '../../index-curves/find-optional-index-curve';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { ApplicationRepository } from '../application.repository';
import { findOwnedApplication } from '../shared/find-owned-application';
import { ReviseApplicationCommand } from './revise-application.command';

@Injectable()
export class ReviseApplicationUseCase
  implements CommandHandler<ReviseApplicationCommand, void>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly indexCurveRepository: IndexCurveRepository,
    private readonly applicationRepository: ApplicationRepository,
  ) {}

  // Overrides capture a replacement snapshot; previous snapshots stay intact.
  async execute(
    command: ReviseApplicationCommand,
  ): Promise<Result<void, AppError>> {
    const { investment } = command;
    const application = await findOwnedApplication(
      this.applicationRepository,
      command.applicationId,
      command.ownerId,
    );
    if (application.isErr()) return application;

    const current = await this.offerRepository.findById(
      application.value.offerSnapshotId,
    );
    if (current.isErr()) return current;
    const replacesSnapshot = Object.keys(investment.overrides).length > 0;
    const snapshot = replacesSnapshot
      ? current.value.createSnapshot(investment.overrides)
      : Result.ok(current.value);
    if (snapshot.isErr()) return snapshot;

    const curve = await findOptionalIndexCurve(
      this.indexCurveRepository,
      investment.indexCurveId,
    );
    if (curve.isErr()) return curve;

    const revision = application.value.revise({
      offerSnapshot: snapshot.value,
      indexCurve: curve.value,
      principal: investment.principal,
      investmentDate: investment.investmentDate,
    });
    if (revision.isErr()) return revision;

    if (replacesSnapshot) {
      const snapshotSave = await this.offerRepository.save(snapshot.value);
      if (snapshotSave.isErr()) return snapshotSave;
    }
    return this.applicationRepository.save(application.value);
  }
}
