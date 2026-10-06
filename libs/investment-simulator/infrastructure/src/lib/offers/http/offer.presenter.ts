import type { PaginatedResult } from '@investflow/shared-types';
import { OfferReadModel } from '../queries/offer-read-model.type';

export class OfferPresenter {
  static present(offer: OfferReadModel) {
    return { ...offer, maturityDate: offer.maturityDate.toIsoString() };
  }

  static page(
    page: PaginatedResult<OfferReadModel>,
  ): PaginatedResult<ReturnType<typeof OfferPresenter.present>> {
    return { ...page, items: page.items.map(OfferPresenter.present) };
  }
}
