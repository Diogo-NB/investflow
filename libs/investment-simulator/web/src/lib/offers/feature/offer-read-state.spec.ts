import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { OfferListState } from './offer-list-state';
import { OfferDetailsState } from './offer-details-state';
const base = '/api/investment-simulator/offers';
describe('Offer read state', () => {
  let http: HttpTestingController;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    query = new BehaviorSubject(convertToParamMap({}));
    params = new BehaviorSubject(convertToParamMap({ offerId: 'offer-id' }));
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OfferListState,
        OfferDetailsState,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: query,
            paramMap: params,
            snapshot: { queryParamMap: query.value, paramMap: params.value },
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));
  it('loads an empty page, recovers from a failed read, and coordinates filter navigation', async () => {
    const state = TestBed.inject(OfferListState);
    expect(state.view().status).toBe('loading');
    TestBed.tick();
    http
      .expectOne((r) => r.url === base)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(state.view().status).toBe('error');
    state.retry();
    state.retry();
    TestBed.tick();
    http
      .expectOne((r) => r.url === base)
      .flush({ items: [], total: 0, page: 1, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(state.view().status).toBe('ready');
    state.setSearch(' Local ');
    state.searchOffers();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'Local', titleType: null, page: null },
      }),
    );
    await state.apply({ titleType: 'LCI' });
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: null, titleType: 'LCI', page: null },
      }),
    );
  });
  it('cancels obsolete requests and restores search from URL changes', async () => {
    const state = TestBed.inject(OfferListState);
    TestBed.tick();
    const old = http.expectOne((r) => r.url === base);
    query.next(convertToParamMap({ q: 'Local', page: '2' }));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    expect(state.search()).toBe('Local');
    const next = http.expectOne(
      (r) => r.url === base && r.params.get('q') === 'Local',
    );
    next.flush({ items: [], total: 1, page: 2, pageSize: 20 });
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(state.outOfRange()).toBe(true);
    expect(state.lastPage()).toBe(1);
  });
  it('exposes missing details and refreshes when the route identifier changes', async () => {
    const state = TestBed.inject(OfferDetailsState);
    TestBed.tick();
    http
      .expectOne(`${base}/offer-id`)
      .flush({}, { status: 404, statusText: 'Missing' });
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(state.view()).toMatchObject({ status: 'error', missing: true });
    params.next(convertToParamMap({ offerId: 'next-offer' }));
    TestBed.tick();
    http.expectOne(`${base}/next-offer`).flush({ id: 'next-offer' });
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    expect(state.view().status).toBe('ready');
  });
  it('coordinates deletion, failed retries, and an already deleted offer', async () => {
    const state = TestBed.inject(OfferDetailsState);
    TestBed.tick();
    http.expectOne(`${base}/offer-id`).flush({ id: 'offer-id' });
    TestBed.tick();
    const pending = state.remove();
    expect(await state.remove()).toBeUndefined();
    http
      .expectOne(`${base}/offer-id`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await pending).toBeUndefined();
    expect(state.operation().status).toBe('error');
    const retry = state.remove();
    const request = http.expectOne(`${base}/offer-id`);
    expect(request.request.method).toBe('DELETE');
    request.flush({}, { status: 404, statusText: 'Missing' });
    expect(await retry).toBe('missing');
    expect(state.operation().status).toBe('success');
  });
});
