import { Injectable } from '@nestjs/common';
import { Application } from '@investflow/investment-simulator-domain';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { findOptionalIndexCurve } from '../../index-curves/find-optional-index-curve';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { ApplicationRepository } from '../application.repository';
import { CreateApplicationCommand } from './create-application.command';

export interface CreateApplicationOutput {
  readonly id: string;
}

@Injectable()
export class CreateApplicationUseCase
  implements CommandHandler<CreateApplicationCommand, CreateApplicationOutput>
{
  constructor(
    private readonly offerRepository: OfferRepository,
    private readonly indexCurveRepository: IndexCurveRepository,
    private readonly applicationRepository: ApplicationRepository,
  ) {}

  // Captures the catalog offer in a new snapshot owned by the application.
  async execute(
    command: CreateApplicationCommand,
  ): Promise<Result<CreateApplicationOutput, AppError>> {
    const { investment } = command;
    const offerResult = await this.offerRepository.findById(command.offerId);
    if (offerResult.isErr()) return offerResult;
    if (offerResult.value.isSnapshot) {
      return Result.err(new OfferNotFoundError(command.offerId));
    }
    const snapshot = offerResult.value.createSnapshot(investment.overrides);
    if (snapshot.isErr()) return snapshot;

    const curve = await findOptionalIndexCurve(
      this.indexCurveRepository,
      investment.indexCurveId,
    );
    if (curve.isErr()) return curve;

    const application = Application.create({
      ownerId: command.ownerId,
      offerSnapshot: snapshot.value,
      indexCurve: curve.value,
      principal: investment.principal,
      investmentDate: investment.investmentDate,
    });
    if (application.isErr()) return application;

    const snapshotSave = await this.offerRepository.save(snapshot.value);
    if (snapshotSave.isErr()) return snapshotSave;
    const saved = await this.applicationRepository.save(application.value);
    return saved.map(() => ({ id: application.value.id }));
  }
}
