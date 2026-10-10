export interface WebEnvironment {
  readonly keycloak: {
    readonly url: string;
    readonly realm: string;
    readonly clientId: string;
  };
}
