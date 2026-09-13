import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { InvestmentSimulatorHelloResponse } from '../models/investment-simulator-hello-response.type';
import { InvestmentSimulatorApi } from '../api/investment-simulator-api.service';
import { InvestmentSimulatorPage } from './investment-simulator-page.component';

describe('InvestmentSimulatorPage', () => {
  let fixture: ComponentFixture<InvestmentSimulatorPage>;
  let response: Subject<InvestmentSimulatorHelloResponse>;
  let api: { hello: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    response = new Subject<InvestmentSimulatorHelloResponse>();
    api = { hello: vi.fn(() => response.asObservable()) };

    await TestBed.configureTestingModule({
      imports: [InvestmentSimulatorPage],
      providers: [{ provide: InvestmentSimulatorApi, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvestmentSimulatorPage);
    fixture.detectChanges();
  });

  it('shows a loading state while the request is pending', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'Conectando ao simulador',
    );
    expect(api.hello).toHaveBeenCalledOnce();
  });

  it('shows the API message after a successful request', () => {
    response.next({ message: 'Hello World' });
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Serviço disponível');
    expect(fixture.nativeElement.textContent).toContain('Hello World');
  });

  it('shows a recoverable failure state', () => {
    response.error(new Error('unavailable'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Não foi possível conectar',
    );
    expect(
      fixture.debugElement.query(By.css('button.retry-button')),
    ).not.toBeNull();
  });

  it('retries the request and returns to loading', () => {
    response.error(new Error('unavailable'));
    fixture.detectChanges();

    response = new Subject<InvestmentSimulatorHelloResponse>();
    fixture.debugElement
      .query(By.css('button.retry-button'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(api.hello).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain(
      'Conectando ao simulador',
    );
  });
});
