import {
  CreateCurveUseCase,
  DeleteCurveUseCase,
  DuplicateCurveUseCase,
  EditCurveUseCase,
} from '@investflow/investment-simulator-application';
import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import { GetCurveQueryHandler } from '../queries/get-curve.query-handler';
import { ListCurvesQueryHandler } from '../queries/list-curves.query-handler';
import { CurveController } from './curve.controller';
import { CreateCurveRequest } from './requests/create-curve.request';
import { EditCurveRequest } from './requests/edit-curve.request';

jest.mock('@investflow/shared-infrastructure', () => ({
  CurrentUser: () => () => undefined,
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

const USER = { userId: 'user-id', email: 'user@example.com' };
const CURVE_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function handler<T>() {
  return { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as T & {
    execute: jest.Mock;
  };
}

function setup() {
  const create = handler<CreateCurveUseCase>();
  const edit = handler<EditCurveUseCase>();
  const duplicate = handler<DuplicateCurveUseCase>();
  const remove = handler<DeleteCurveUseCase>();
  const list = handler<ListCurvesQueryHandler>();
  const get = handler<GetCurveQueryHandler>();
  return {
    controller: new CurveController(create, edit, duplicate, remove, list, get),
    create,
    edit,
    duplicate,
    remove,
    list,
    get,
  };
}

describe('CurveController', () => {
  it('reads curves visible to the user', async () => {
    const { controller, list, get } = setup();

    await controller.list(USER, { index: EEconomicIndex.CDI });
    await controller.get(USER, { curveId: CURVE_ID });

    expect(list.execute).toHaveBeenCalledWith({
      index: EEconomicIndex.CDI,
      viewerId: USER.userId,
    });
    expect(get.execute).toHaveBeenCalledWith({
      curveId: CURVE_ID,
      viewerId: USER.userId,
    });
  });

  it('creates, edits, duplicates and deletes as the user', async () => {
    const { controller, create, edit, duplicate, remove } = setup();
    const params = { curveId: CURVE_ID };

    await controller.create(
      USER,
      Object.assign(new CreateCurveRequest(), {
        index: EEconomicIndex.SELIC,
        name: 'Minha SELIC',
        intervals: [
          { startDate: '2026-10-01', endDate: '2026-10-31', value: '0.12' },
        ],
      }),
    );
    await controller.edit(
      USER,
      params,
      Object.assign(new EditCurveRequest(), { revision: 4, description: null }),
    );
    await controller.duplicate(USER, params);
    await controller.delete(USER, params);

    expect(create.execute.mock.calls[0][0]).toMatchObject({
      actorId: USER.userId,
      index: EEconomicIndex.SELIC,
      description: null,
    });
    expect(edit.execute.mock.calls[0][0]).toMatchObject({
      actorId: USER.userId,
      curveId: CURVE_ID,
      revision: 4,
      name: undefined,
      description: null,
      intervals: undefined,
    });
    for (const useCase of [duplicate, remove]) {
      expect(useCase.execute.mock.calls[0][0]).toMatchObject({
        actorId: USER.userId,
        curveId: CURVE_ID,
      });
    }
  });
});
