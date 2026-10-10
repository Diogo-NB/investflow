import { ApplicationRepository } from '../application.repository';
import { Clock } from '@investflow/shared-application';
import { Result, UtcInstant } from '@investflow/shared-domain';
import { ApplicationNotFoundError } from '../application-not-found.error';
import { ownedApplication, OWNER_ID } from '../shared/application-fixture';
import { DeleteApplicationCommand } from './delete-application.command';
import { DeleteApplicationUseCase } from './delete-application.use-case';

const NOW = UtcInstant.ofIso('2026-10-10T12:00:00Z');

function setup() {
  const repos = {
    applications: {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    } as unknown as jest.Mocked<ApplicationRepository>,
  };
  const { application } = ownedApplication();
  repos.applications.findById.mockResolvedValue(Result.ok(application));
  const clock = { now: () => NOW } as unknown as Clock;
  return {
    application,
    repos,
    useCase: new DeleteApplicationUseCase(repos.applications, clock),
  };
}

describe('DeleteApplicationUseCase', () => {
  it('soft deletes an owned application', async () => {
    const { application, repos, useCase } = setup();

    const result = await useCase.execute(
      DeleteApplicationCommand.fromRequest(OWNER_ID, {
        applicationId: application.id,
      }),
    );

    expect(result.isOk()).toBe(true);
    expect(application.deletedAt).toBe(NOW);
    expect(repos.applications.save).toHaveBeenCalledWith(application);
  });

  it("reports another owner's application as not found", async () => {
    const { application, repos, useCase } = setup();

    const result = await useCase.execute(
      DeleteApplicationCommand.fromRequest('someone-else', {
        applicationId: application.id,
      }),
    );

    expect(result.error).toBeInstanceOf(ApplicationNotFoundError);
    expect(application.deletedAt).toBeNull();
    expect(repos.applications.save).not.toHaveBeenCalled();
  });
});
