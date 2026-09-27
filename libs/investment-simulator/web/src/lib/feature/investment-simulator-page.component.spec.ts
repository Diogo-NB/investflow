import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InvestmentSimulatorStore } from './investment-simulator.store';
import { InvestmentSimulatorPage } from './investment-simulator-page.component';

describe('InvestmentSimulatorPage', () => {
  const store = {
    state: signal({ kind: 'loading' as const }).asReadonly(),
    load: vi.fn(),
    retry: vi.fn(),
  };

  beforeEach(() => {
    store.load.mockClear();
    store.retry.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: InvestmentSimulatorStore, useValue: store }],
    });
  });

  it('loads state and exposes it to the template', () => {
    const component = TestBed.runInInjectionContext(
      () => new InvestmentSimulatorPage(),
    );

    expect(store.load).toHaveBeenCalledOnce();
    expect(component.state()).toEqual({ kind: 'loading' });
  });

  it('delegates retry intent to the store', () => {
    const component = TestBed.runInInjectionContext(
      () => new InvestmentSimulatorPage(),
    );

    component.retry();

    expect(store.retry).toHaveBeenCalledOnce();
  });
});
