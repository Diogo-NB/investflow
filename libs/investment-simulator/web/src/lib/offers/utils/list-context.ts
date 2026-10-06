import { ParamMap, Params } from '@angular/router';
import { OfferFilters, titleTypes, TitleType } from '../models/offer.type';

export function readFilters(params: ParamMap): OfferFilters {
  const page = Number(params.get('page') ?? 1);
  const title = params.get('titleType');
  return {
    page: Number.isSafeInteger(page) && page > 0 && page <= 21474836 ? page : 1,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    titleType: titleTypes.includes(title as TitleType)
      ? (title as TitleType)
      : '',
  };
}
export function filterParams(filters: OfferFilters): Params {
  return {
    q: filters.q || null,
    titleType: filters.titleType || null,
    page: filters.page > 1 ? filters.page : null,
  };
}
