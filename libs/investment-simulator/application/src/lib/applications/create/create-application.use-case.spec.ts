import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { ApplicationRepository } from '../application.repository';
import { Application, Offer } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import {
  catalogOffer,
  cdiCurve,
  OWNER_ID,
} from '../shared/application-fixture';
import { CreateApplicationCommand } from './create-application.command';
import { CreateApplicationUseCase } from './create-application.use-case';

function repositories() {
  return {
    offers: {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    } as unknown as jest.Mocked<OfferRepository>,
    curves: {
      findById: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<IndexCurveRepository>,
    applications: {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    } as unknown as jest.Mocked<ApplicationRepository>,
  };
}

function setup(offer: Offer) {
  const repos = repositories();
  repos.offers.findById.mockResolvedValue(Result.ok(offer));
  return {
    repos,
    useCase: new CreateApplicationUseCase(
      repos.offers,
      repos.curves,
      repos.applications,
    ),
  };
}

function command(overrides: Record<string, unknown> = {}) {
  return CreateApplicationCommand.fromRequest(OWNER_ID, {
    offerId: 'offer-id',
    principal: '1000.5',
    investmentDate: '2026-01-02',
    ...overrides,
  });
}

describe('CreateApplicationUseCase', () => {
  it('captures a snapshot with overrides and links the chosen curve', async () => {
    const offer = catalogOffer('CDI_PERCENTAGE');
    const curve = cdiCurve();
    const { repos, useCase } = setup(offer);
    repos.curves.findById.mockResolvedValue(Result.ok(curve));

    const result = await useCase.execute(
      command({ indexCurveId: curve.id, maturityDate: '2029-01-02' }),
    );

    const snapshot = repos.offers.save.mock.calls[0][0];
    const application = repos.applications.save.mock.calls[0][0] as Application;
    expect(snapshot.sourceOfferId).toBe(offer.id);
    expect(snapshot.maturityDate.toIsoString()).toBe('2029-01-02');
    expect(application.id).toBe(result.value.id);
    expect(application.ownerId).toBe(OWNER_ID);
    expect(application.offerSnapshotId).toBe(snapshot.id);
    expect(application.indexCurveId).toBe(curve.id);
    expect(application.principal.amount.toString()).toBe('1000.5');
  });

  it('treats a snapshot id as an unknown catalog offer', async () => {
    const { repos, useCase } = setup(catalogOffer().createSnapshot().value);

    const result = await useCase.execute(command());

    expect(result.error).toBeInstanceOf(OfferNotFoundError);
    expect(repos.offers.save).not.toHaveBeenCalled();
  });

  it('saves nothing when the investment is invalid', async () => {
    const { repos, useCase } = setup(catalogOffer('CDI_PERCENTAGE'));

    const result = await useCase.execute(command());

    expect(result.error.code).toBe('INVALID_APPLICATION');
    expect(result.error.metadata?.['scenarioCode']).toBe(
      'INVESTMENT_CURVE_REQUIRED',
    );
    expect(repos.curves.findById).not.toHaveBeenCalled();
    expect(repos.offers.save).not.toHaveBeenCalled();
    expect(repos.applications.save).not.toHaveBeenCalled();
  });
});
