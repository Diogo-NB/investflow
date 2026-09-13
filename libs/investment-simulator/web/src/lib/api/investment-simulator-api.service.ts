import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { InvestmentSimulatorHelloResponse } from '../models/investment-simulator-hello-response.type';

@Injectable({ providedIn: 'root' })
export class InvestmentSimulatorApi {
  private readonly http = inject(HttpClient);

  hello(): Observable<InvestmentSimulatorHelloResponse> {
    return this.http.get<InvestmentSimulatorHelloResponse>(
      '/api/investment-simulator/hello',
    );
  }
}
