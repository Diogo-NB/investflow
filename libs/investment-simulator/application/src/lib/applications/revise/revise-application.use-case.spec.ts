import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { ApplicationRepository } from '../application.repository';
import { Result } from '@investflow/shared-domain';
import { ApplicationNotFoundError } from '../application-not-found.error';
import { ownedApplication, OWNER_ID } from '../shared/application-fixture';
import { ReviseApplicationCommand } from './revise-application.command';
import { ReviseApplicationUseCase } from './revise-application.use-case';

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

function setup() {
  const repos = repositories();
  const owned = ownedApplication();
  repos.applications.findById.mockResolvedValue(Result.ok(owned.application));
  repos.offers.findById.mockResolvedValue(Result.ok(owned.snapshot));
  return {
    ...owned,
    repos,
    useCase: new ReviseApplicationUseCase(
      repos.offers,
      repos.curves,
      repos.applications,
    ),
  };
}

function command(ownerId: string, overrides: Record<string, unknown> = {}) {
  return ReviseApplicationCommand.fromRequest(
    ownerId,
    { applicationId: 'application-id' },
    { principal: '2000', investmentDate: '2026-02-02', ...overrides },
  );
}

describe('ReviseApplicationUseCase', () => {
  it('keeps the current snapshot when no terms change', async () => {
    const { application, snapshot, repos, useCase } = setup();

    const result = await useCase.execute(command(OWNER_ID));

    expect(result.isOk()).toBe(true);
    expect(application.offerSnapshotId).toBe(snapshot.id);
    expect(application.principal.amount.toString()).toBe('2000');
    expect(repos.offers.save).not.toHaveBeenCalled();
    expect(repos.applications.save).toHaveBeenCalledWith(application);
  });

  it('captures a replacement snapshot for overridden terms', async () => {
    const { application, snapshot, repos, useCase } = setup();

    await useCase.execute(
      command(OWNER_ID, {
        remunerationTerms: { kind: 'PREFIXED', rate: '0.2' },
      }),
    );

    const replacement = repos.offers.save.mock.calls[0][0];
    expect(replacement.id).not.toBe(snapshot.id);
    expect(replacement.sourceOfferId).toBe(snapshot.sourceOfferId);
    expect(application.offerSnapshotId).toBe(replacement.id);
  });

  it("looks up the requester's application and stops when it is missing", async () => {
    const { repos, useCase } = setup();
    const error = new ApplicationNotFoundError('application-id');
    repos.applications.findById.mockResolvedValue(Result.err(error));

    const result = await useCase.execute(command('someone-else'));

    expect(repos.applications.findById).toHaveBeenCalledWith(
      'application-id',
      'someone-else',
    );
    expect(result.error).toBe(error);
    expect(repos.applications.save).not.toHaveBeenCalled();
  });
});
