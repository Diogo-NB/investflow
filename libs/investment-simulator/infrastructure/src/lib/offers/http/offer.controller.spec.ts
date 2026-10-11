import {
  CreateOfferUseCase,
  DeleteOfferUseCase,
  DuplicateOfferUseCase,
  EditOfferUseCase,
} from '@investflow/investment-simulator-application';
import { ETitleType } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import { GetOfferQueryHandler } from '../queries/get-offer.query-handler';
import { ListOffersQueryHandler } from '../queries/list-offers.query-handler';
import { OfferController } from './offer.controller';
import { CreateOfferRequest } from './requests/create-offer.request';
import { EditOfferRequest } from './requests/edit-offer.request';

jest.mock('@investflow/shared-infrastructure', () => ({
  CurrentUser: () => () => undefined,
  IsCalendarDate: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

const USER = { userId: 'user-id', email: 'user@example.com' };
const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function handler<T>() {
  return { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as T & {
    execute: jest.Mock;
  };
}

function setup() {
  const create = handler<CreateOfferUseCase>();
  const edit = handler<EditOfferUseCase>();
  const duplicate = handler<DuplicateOfferUseCase>();
  const remove = handler<DeleteOfferUseCase>();
  const list = handler<ListOffersQueryHandler>();
  const get = handler<GetOfferQueryHandler>();
  return {
    controller: new OfferController(create, edit, duplicate, remove, list, get),
    create,
    edit,
    duplicate,
    remove,
    list,
    get,
  };
}

describe('OfferController', () => {
  it('reads offers visible to the user', async () => {
    const { controller, list, get } = setup();

    await controller.list(USER, {
      page: 2,
      pageSize: 20,
      titleType: ETitleType.CDB,
    });
    await controller.get(USER, { offerId: OFFER_ID });

    expect(list.execute).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      titleType: ETitleType.CDB,
      viewerId: USER.userId,
    });
    expect(get.execute).toHaveBeenCalledWith({
      offerId: OFFER_ID,
      viewerId: USER.userId,
    });
  });

  it('creates, edits, duplicates and deletes as the user', async () => {
    const { controller, create, edit, duplicate, remove } = setup();
    const params = { offerId: OFFER_ID };

    await controller.create(
      USER,
      Object.assign(new CreateOfferRequest(), {
        titleType: ETitleType.LCA,
        name: 'LCA 93% do CDI',
        maturityDate: '2030-05-20',
        redemptionTerms: { kind: 'AT_MATURITY' },
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '0.93' },
      }),
    );
    await controller.edit(
      USER,
      params,
      Object.assign(new EditOfferRequest(), { revision: 4, issuerName: null }),
    );
    await controller.duplicate(USER, params);
    await controller.delete(USER, params);

    expect(create.execute.mock.calls[0][0]).toMatchObject({
      actorId: USER.userId,
      titleType: ETitleType.LCA,
      name: 'LCA 93% do CDI',
      issuerName: null,
    });
    expect(edit.execute.mock.calls[0][0]).toMatchObject({
      actorId: USER.userId,
      offerId: OFFER_ID,
      revision: 4,
      name: undefined,
      issuerName: null,
      maturityDate: undefined,
    });
    for (const useCase of [duplicate, remove]) {
      expect(useCase.execute.mock.calls[0][0]).toMatchObject({
        actorId: USER.userId,
        offerId: OFFER_ID,
      });
    }
  });
});
