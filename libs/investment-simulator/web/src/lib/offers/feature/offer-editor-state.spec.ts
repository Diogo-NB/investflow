import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { OfferEditorState } from './offer-editor-state';
import { Offer } from '../models/offer.type';
const base = '/api/investment-simulator/offers';
const original: Offer = {
  id: 'offer-id',
  titleType: 'CDB',
  issuer: { id: 'issuer-id', name: 'Banco Local' },
  maturityDate: '2028-12-31',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
};
function populate(state: OfferEditorState): void {
  state.form.titleType().value.set('CDB');
  state.form.issuerId().value.set('issuer-id');
  state.form.maturityDate().value.set('2028-12-31');
  state.form.redemptionKind().value.set('DAILY');
  state.form.remunerationKind().value.set('CDI_PERCENTAGE');
  state.form.percentage().value.set('110');
}
describe('OfferEditorState', () => {
  let state: OfferEditorState;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OfferEditorState,
      ],
    });
    state = TestBed.inject(OfferEditorState);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('blocks invalid submissions, marks fields touched, and does not send requests', async () => {
    expect(await state.save()).toBeUndefined();
    expect(state.form.titleType().touched()).toBe(true);
    http.expectNone(base);
  });
  it('creates exactly once, disables pending edits, and clears dirty state on success', async () => {
    populate(state);
    expect(state.dirty()).toBe(true);
    const saving = state.save();
    const duplicate = state.save();
    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.remunerationTerms.rate).toBe('1.1');
    expect(state.pending()).toBe(true);
    expect(await duplicate).toBeUndefined();
    request.flush({ id: 'new-offer' });
    expect(await saving).toBe('new-offer');
    expect(state.operation().status).toBe('success');
    expect(state.dirty()).toBe(false);
    expect(await state.save()).toBeUndefined();
    http.expectNone(base);
  });
  it('preserves values and allows an explicit retry after server failure', async () => {
    populate(state);
    const saving = state.save();
    http.expectOne(base).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await saving).toBeUndefined();
    expect(state.operation().status).toBe('error');
    expect(state.values().percentage).toBe('110');
    expect(state.dirty()).toBe(true);
    const retry = state.save();
    http.expectOne(base).flush({ id: 'retry-offer' });
    expect(await retry).toBe('retry-offer');
  });
  it('does not save unchanged edits and omits immutable fields from PATCH', async () => {
    state.initialize(original);
    expect(await state.save()).toBeUndefined();
    http.expectNone(`${base}/offer-id`);
    state.form.maturityDate().value.set('2029-01-01');
    const saving = state.save();
    const request = http.expectOne(`${base}/offer-id`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ maturityDate: '2029-01-01' });
    request.flush(null);
    expect(await saving).toBe('offer-id');
    expect(state.dirty()).toBe(false);
  });
  it('clears a rate when its meaning changes and retains original precision while editing', () => {
    state.initialize({
      ...original,
      remunerationTerms: {
        kind: 'CDI_PERCENTAGE',
        rate: '1.12345678901234567890123456789',
      },
    });
    expect(state.values().percentage).toBe('112,345678901234567890123456789');
    expect(state.dirty()).toBe(false);
    state.changeRemuneration('PREFIXED');
    expect(state.values().percentage).toBe('');
    expect(state.form.percentage().invalid()).toBe(true);
    expect(state.dirty()).toBe(true);
  });
});
