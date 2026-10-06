import { CanDeactivateFn, Routes } from '@angular/router';
import type { OfferEditorPage } from '../offers/feature/offer-editor-page';
const protectOfferChanges: CanDeactivateFn<OfferEditorPage> = (page) =>
  page.canLeave();
export const investmentSimulatorRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Ofertas | InvestFlow',
    loadComponent: () =>
      import('../offers/feature/offer-list').then((m) => m.OfferList),
  },
  {
    path: 'nova',
    title: 'Nova oferta | InvestFlow',
    canDeactivate: [protectOfferChanges],
    loadComponent: () =>
      import('../offers/feature/offer-editor-page').then(
        (m) => m.OfferEditorPage,
      ),
  },
  {
    path: ':offerId/editar',
    title: 'Editar oferta | InvestFlow',
    canDeactivate: [protectOfferChanges],
    loadComponent: () =>
      import('../offers/feature/offer-editor-page').then(
        (m) => m.OfferEditorPage,
      ),
  },
  {
    path: ':offerId',
    title: 'Oferta | InvestFlow',
    loadComponent: () =>
      import('../offers/feature/offer-details').then((m) => m.OfferDetails),
  },
];
