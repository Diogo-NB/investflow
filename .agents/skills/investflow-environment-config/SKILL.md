---
name: investflow-environment-config
description: Declare, validate, inject, and debug InvestFlow environment variables in NestJS code. Use when a change adds, renames, or removes an environment variable or its default; creates or edits a `*.config.ts` file or `environmentConfig`; injects configuration into a provider, module, host, or tool; touches `.env.example` or the environment of `infra/dokploy/compose.yaml`; or when a host fails at startup with "Invalid <namespace> environment", or a value is not the one expected. Do not use for frontend `VITE_` variables, the Prisma CLI config, or the CDK app.
---

# InvestFlow Environment Config

Every environment variable Nest code reads is declared once, in a schema
owned by the capability that uses it, and checked when the host starts. A
host checks exactly the capabilities it imports, so the seed never needs
Keycloak and the API cannot start without its queue URLs. Why this design and
what was rejected is in "Environment Configuration" in
`docs/architecture/project-structure.md`.

## How it works

1. The host's `ConfigModule.forRoot()` (in `SharedInfrastructureModule`, the
   seed, and the benchmark) loads `.env` into `process.env`. It never
   overrides a variable the shell or container already set.
2. A capability declares `<capability>.config.ts` beside its module:

   ```ts
   const databaseEnvironment = z.object({
     DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
   });

   export const databaseConfig = environmentConfig('database', databaseEnvironment, (environment) => ({ url: environment.DATABASE_URL }));

   export type DatabaseConfig = ConfigType<typeof databaseConfig>;
   ```

   `<capability>Environment` is the zod schema of the raw variables;
   `<capability>Config` is the registered namespace, whose `.KEY` is the
   injection token; `<Capability>Config` is the typed object providers get.
   The schema is a named constant, never inline in the call, and stays
   private unless its own spec needs it. The mapping stays inline.

3. The capability's module imports `ConfigModule.forFeature(databaseConfig)`.
   Nest builds that provider while starting, `environmentConfig`
   (`libs/shared/infrastructure/src/lib/config/environment-config.ts`) parses
   `process.env` against the schema, and a failure stops startup. An empty
   value counts as unset, so `NAME=` falls back to the default or is
   reported missing.
4. Providers inject the typed object:
   `@Inject(databaseConfig.KEY) config: DatabaseConfig`.

The configs that exist, with their variables and owners, are listed in
"Environment Configuration" in `docs/architecture/project-structure.md`.

## Rules

- Nest code never calls `ConfigService.get`, `getOrThrow`, or reads
  `process.env`; only `environmentConfig` does. Outside Nest, these read
  `process.env` directly: `libs/shared/infrastructure/prisma/prisma.config.ts`
  (Prisma CLI), `infra/aws` (CDK), `apps/api/webpack.config.js`, and test
  setup (`INTEGRATION_TEST_DATABASE_URL`, the clients a spec creates itself).
- One config per capability, beside the module that imports it. A variable
  two capabilities read gets a capability of its own, as `AWS_REGION` has
  `aws`, so its rule has one home.
- Defaults live only in the schema (`.default(…)`), never in the mapping, a
  provider, `.env.example`, or the compose file.
- A variable's name carries its unit (`_SECONDS`, `_MS`), and the mapping
  converts it to the unit the code uses.
- Secrets have no default and are never logged. `environmentConfig` reports
  the variable and zod's message, never the value; keep custom `refine`
  messages free of values too.
- Validate what a wrong value would break: URLs with `z.url()` (and a
  `protocol` when only some work), numbers with `z.coerce.number()` and
  bounds, names with `.min(1)`, and relations between variables with
  `.refine()`.
- AWS credentials and `AWS_ENDPOINT_URL` stay with the AWS SDK's provider
  chain (environment, profile, IAM Roles Anywhere); never put them in a
  schema.
- Tests do not parse the environment: unit tests pass the typed object
  (`new JwtStrategy({ url, realm, clientId })`), testing modules use
  `.overrideProvider(databaseConfig.KEY).useValue(…)` or set `process.env`
  before compiling, as `messaging.integration.spec.ts` does to exercise the
  real path, and restore it afterwards.

## Scenario: a host fails to start or reads the wrong value

The error names the capability and every failing variable of it:

```text
Error: Invalid keycloak environment:
  - KEYCLOAK_URL: Invalid URL
  - KEYCLOAK_REALM: Invalid input: expected string, received undefined
```

Nest stops at the first failing capability, in module order, so fix it and
start again to see the next one. Then find where the value comes from, in
order of precedence:

1. The shell or container environment: `env | grep KEYCLOAK`. A shell
   variable wins over `.env`, a common cause of "I changed `.env` and nothing
   happened"; `env -u NAME` runs without it. The same precedence applies to
   `AWS_PROFILE` against the `.env` key pair (see `investflow-local-testing`).
2. `.env` at the working directory of the process. A tool run from another
   directory finds no `.env`.
3. Production: the API's `environment` in `infra/dokploy/compose.yaml` and,
   for secrets, Dokploy's environment (`docs/architecture/deployment.md`).

Things to rule out:

- A value that is set but ignored: an empty one (`NAME=`) counts as unset,
  so the default applies; a value with quotes or trailing spaces from a
  hand-edited `.env` fails its rule.
- In compose, `${NAME:?}` fails the deploy when Dokploy lacks the variable,
  and `${NAME:-}` passes an empty value when it lacks it, so the schema
  default applies.
- A test module that provides values with `ConfigModule.forRoot({ load })`
  does not reach the schemas; they read `process.env`.
- To see the values a provider received, read its injected config object in
  a debugger or a test; do not log configs, they may hold secrets.

## Scenario: adding an environment variable

1. Decide whether it should be a variable at all. Yes for deployment facts
   (URLs, names, regions), credentials, and operational tuning no other rule
   depends on (a poll interval). No for provider limits (EventBridge batch
   size), contracts with other code (the outbox payload limit), or values
   another value is derived from (the poller's grace period from the relay's
   timeouts): those stay named constants beside their reason.
2. Pick the owning capability; create its `*.config.ts` if it has none, and
   import `ConfigModule.forFeature(<capability>Config)` in its module.
3. Add the schema line with its rule and, when it has a safe value, its
   default; add the typed field to the mapping, in code units.
4. Inject the config where it is used (next scenario).
5. Add it to `.env.example`, commented out when it has a default. When
   production sets it, add it to the API's `environment` in
   `infra/dokploy/compose.yaml` (a literal when not secret, `${NAME:?}` when
   Dokploy holds it, `${NAME:-}` for optional tuning) and update the list
   in `docs/architecture/deployment.md`.
6. Document why its default is what it is in the architecture doc that owns
   the behavior (`messaging.md` for the outbox).
7. Test any `refine` or non-obvious rule by parsing its schema; do not test
   zod's built-in validators.

## Scenario: injecting and using config

- Provider: `constructor(@Inject(awsConfig.KEY) aws: AwsConfig)`. Import the
  type with `type` (`import { awsConfig, type AwsConfig }`): a type in a
  decorated constructor fails to compile otherwise (TS1272 under
  `isolatedModules`).
- Read the config in the constructor or hook and keep only what is needed
  (`this.eventBusName = eventBridge.eventBusName`), not the whole
  object.
- Factory provider: `{ provide: X, useFactory: (aws: AwsConfig) => …, inject:
[awsConfig.KEY] }`, as the benchmark builds its broker.
- Dynamic module whose variables depend on its options: build the schema in a
  named local function, register it with `ConfigModule.forFeature`, and
  alias it to a token of the module's own with `useExisting`, as
  `SqsConsumersModule.register()` does for the queue URLs. Never spread
  `asProvider()` into a provider; it is for async module options.
- Host bootstrap, outside DI: `app.get<ServerConfig>(serverConfig.KEY)` after
  `NestFactory.create`, as `apps/api/src/main.ts` reads the port.
- Another module needs the same variable: import the same
  `ConfigModule.forFeature(<capability>Config)` there; never re-declare the
  variable in a second schema.
- Never read a namespace by string (`config.get('database.url')`).

## Before finishing

- No `ConfigService`, `getOrThrow`, or `process.env` in Nest code outside
  `environmentConfig`.
- Each variable is declared in one schema, owned by its capability, with its
  rule and any default there only.
- The schema is a named `<capability>Environment` constant; the config is
  `<capability>Config` with a `<Capability>Config` type.
- Names carry their units; the mapping converts them.
- No secret has a default or reaches a log or an error message.
- `.env.example`, `compose.yaml`, and `deployment.md` list the variable when
  local or production setup needs it.
- The host starts with the real `.env`, and fails with a readable message
  when the variable is missing or invalid.
