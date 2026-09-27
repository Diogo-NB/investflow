export interface WebEnvironment {
  readonly production: boolean;
  readonly keycloak: {
    readonly url: string;
    readonly realm: string;
    readonly clientId: string;
  };
}
