import {
  CreateApplicationUseCase,
  DeleteApplicationUseCase,
  ReviseApplicationUseCase,
} from '@investflow/investment-simulator-application';
import { Result } from '@investflow/shared-domain';
import { GetApplicationQueryHandler } from '../queries/get-application.query-handler';
import { ListApplicationsQueryHandler } from '../queries/list-applications.query-handler';
import { ApplicationController } from './application.controller';
import { CreateApplicationRequest } from './requests/create-application.request';
import { ListApplicationsRequest } from './requests/list-applications.request';

jest.mock('@investflow/shared-infrastructure', () => ({
  CurrentUser: () => () => undefined,
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

const USER = { userId: 'owner-id', email: 'owner@example.com' };
const APPLICATION_ID = 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11';

function handler<T>() {
  return { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as T & {
    execute: jest.Mock;
  };
}

function createFixture() {
  const create = handler<CreateApplicationUseCase>();
  const revise = handler<ReviseApplicationUseCase>();
  const remove = handler<DeleteApplicationUseCase>();
  const list = handler<ListApplicationsQueryHandler>();
  const get = handler<GetApplicationQueryHandler>();
  return {
    controller: new ApplicationController(create, revise, remove, list, get),
    create,
    revise,
    remove,
    list,
    get,
  };
}

describe('ApplicationController', () => {
  it('scopes every read to the authenticated owner', async () => {
    const fixture = createFixture();

    await fixture.controller.list(USER, new ListApplicationsRequest());
    await fixture.controller.get(USER, { applicationId: APPLICATION_ID });

    expect(fixture.list.execute).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      ownerId: USER.userId,
    });
    expect(fixture.get.execute).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      ownerId: USER.userId,
    });
  });

  it('builds owned commands from the request', async () => {
    const fixture = createFixture();
    const request = Object.assign(new CreateApplicationRequest(), {
      offerId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
      principal: '1000.50',
      investmentDate: '2026-01-02',
      indexCurveId: '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e',
    });

    await fixture.controller.create(USER, request);
    await fixture.controller.revise(
      USER,
      { applicationId: APPLICATION_ID },
      request,
    );
    await fixture.controller.delete(USER, { applicationId: APPLICATION_ID });

    const created = fixture.create.execute.mock.calls[0][0];
    expect(created.ownerId).toBe(USER.userId);
    expect(created.offerId).toBe(request.offerId);
    expect(created.investment.principal.amount.toString()).toBe('1000.5');
    expect(created.investment.indexCurveId).toBe(request.indexCurveId);
    expect(created.investment.overrides).toEqual({});
    const revised = fixture.revise.execute.mock.calls[0][0];
    expect(revised.ownerId).toBe(USER.userId);
    expect(revised.applicationId).toBe(APPLICATION_ID);
    const deleted = fixture.remove.execute.mock.calls[0][0];
    expect(deleted).toMatchObject({
      ownerId: USER.userId,
      applicationId: APPLICATION_ID,
    });
  });
});
