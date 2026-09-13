import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvestmentSimulatorApi } from './investment-simulator-api.service';

describe('InvestmentSimulatorApi', () => {
  let api: InvestmentSimulatorApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(InvestmentSimulatorApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests the simulator hello endpoint', () => {
    const response = { message: 'Hello World' };

    api.hello().subscribe((result) => expect(result).toEqual(response));

    const request = httpTesting.expectOne('/api/investment-simulator/hello');
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });
});
