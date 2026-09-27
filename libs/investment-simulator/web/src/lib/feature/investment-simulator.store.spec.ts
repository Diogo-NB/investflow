import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { InvestmentSimulatorApi } from '../api/investment-simulator-api.service';
import { InvestmentSimulatorHelloResponse } from '../models/investment-simulator-hello-response.type';
import { InvestmentSimulatorStore } from './investment-simulator.store';

describe('InvestmentSimulatorStore', () => {
  let api: { hello: ReturnType<typeof vi.fn> };
  let response: Subject<InvestmentSimulatorHelloResponse>;
  let store: InvestmentSimulatorStore;

  beforeEach(() => {
    response = new Subject<InvestmentSimulatorHelloResponse>();
    api = { hello: vi.fn(() => response.asObservable()) };

    TestBed.configureTestingModule({
      providers: [
        InvestmentSimulatorStore,
        { provide: InvestmentSimulatorApi, useValue: api },
      ],
    });

    store = TestBed.inject(InvestmentSimulatorStore);
  });

  it('moves from loading to success', () => {
    store.load();

    expect(store.state()).toEqual({ kind: 'loading' });
    expect(api.hello).toHaveBeenCalledOnce();

    response.next({ message: 'Hello World' });

    expect(store.state()).toEqual({
      kind: 'success',
      message: 'Hello World',
    });
  });

  it('exposes an error state without leaking transport details', () => {
    store.load();

    response.error(new Error('sensitive transport details'));

    expect(store.state()).toEqual({ kind: 'error' });
  });

  it('starts a new request when retrying after a failure', () => {
    store.load();
    response.error(new Error('unavailable'));
    response = new Subject<InvestmentSimulatorHelloResponse>();

    store.retry();

    expect(api.hello).toHaveBeenCalledTimes(2);
    expect(store.state()).toEqual({ kind: 'loading' });
  });
});
