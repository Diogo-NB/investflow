import type { KeycloakConfig } from '@investflow/shared-infrastructure';
import type { ExperimentRunnerConfig } from './experiment-runner.config';

// Refreshed well before the realm's access token lifespan ends.
const TOKEN_REFRESH_MS = 60_000;

export interface CurveInterval {
  readonly startDate: string;
  readonly endDate: string;
  readonly value: string;
}

export interface CreateCurveRequest {
  readonly index: string;
  readonly name: string;
  readonly intervals: readonly CurveInterval[];
}

export interface RemunerationTerms {
  readonly kind: string;
  readonly rate: string;
}

export interface CreateOfferRequest {
  readonly titleType: string;
  readonly name: string;
  readonly issuerName: string;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: string };
  readonly remunerationTerms: RemunerationTerms;
}

export interface CreateSimulationRequest {
  readonly offerId: string;
  readonly investment: {
    readonly principal: string;
    readonly investmentDate: string;
    readonly curveId?: string;
  };
}

// The API as a user reaches it: every write goes through its endpoints, so
// it obeys the domain rules and raises the events a user's would.
export class InvestflowApiClient {
  private token: { readonly value: string; readonly fetchedAt: number } | null =
    null;

  constructor(
    private readonly runner: ExperimentRunnerConfig,
    private readonly keycloak: KeycloakConfig,
  ) {}

  async createCurve(request: CreateCurveRequest): Promise<string> {
    const { curveId } = await this.send<{ curveId: string }>(
      'POST',
      '/investment-simulator/curves',
      request,
    );
    return curveId;
  }

  async createOffer(request: CreateOfferRequest): Promise<string> {
    const { offerId } = await this.send<{ offerId: string }>(
      'POST',
      '/investment-simulator/offers',
      request,
    );
    return offerId;
  }

  async createSimulation(request: CreateSimulationRequest): Promise<string> {
    const { simulationId } = await this.send<{ simulationId: string }>(
      'POST',
      '/investment-simulator/simulations',
      request,
    );
    return simulationId;
  }

  // Reads the revision first, as the offer screen does before saving.
  async changeOfferRemuneration(
    offerId: string,
    remunerationTerms: RemunerationTerms,
  ): Promise<void> {
    const { revision } = await this.send<{ revision: number }>(
      'GET',
      `/investment-simulator/offers/${offerId}`,
    );
    await this.send('PATCH', `/investment-simulator/offers/${offerId}`, {
      revision,
      remunerationTerms,
    });
  }

  private async send<T = void>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.runner.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `${method} ${path} answered ${response.status}: ${await response.text()}`,
      );
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() - this.token.fetchedAt < TOKEN_REFRESH_MS) {
      return this.token.value;
    }
    const { url, realm, clientId } = this.keycloak;
    const response = await fetch(
      `${url}/realms/${realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: clientId,
          client_secret: this.runner.clientSecret,
          username: this.runner.username,
          password: this.runner.password,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Keycloak answered ${response.status} to the login`);
    }
    const { access_token } = (await response.json()) as {
      access_token: string;
    };
    this.token = { value: access_token, fetchedAt: Date.now() };
    return access_token;
  }
}
