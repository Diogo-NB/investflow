# Dependency Injection And Handlers

## Dependency Injection

- Do not use Symbol tokens for Nest providers.
- Use abstract classes as runtime DI tokens when polymorphic injection is
  needed.
- Interfaces are allowed for data shapes and compile-time contracts, but not as
  Nest provider tokens because TypeScript interfaces disappear at runtime.

Example:

```typescript
export abstract class PortfolioRepository {
  abstract save(portfolio: Portfolio): Promise<Result<void, AppError>>;
}

@Module({
  providers: [CreatePortfolioUseCase, { provide: PortfolioRepository, useClass: PrismaPortfolioRepository }],
})
export class InvestmentSimulatorInfrastructureModule {}
```

The bounded-context infrastructure module is its local composition root: it
registers context-owned controllers, handlers, ports, and adapters. A deployable
app is the system composition root: it chooses which bounded-context modules to
import and configures global runtime concerns. Do not make an app enumerate a
context's internal providers.

If different hosts need different adapters, expose focused Nest modules from
the infrastructure project so each app can opt into HTTP, messaging,
persistence, or background work independently.

## Handler Orchestration

- Use simple classes with one `execute(input)` method.
- Controllers and listeners inject use-case or query-handler classes directly.
- Do not add command buses, query buses, or `@nestjs/cqrs` unless explicitly
  requested.
- Shared compile-time handler contracts live in
  `@investflow/shared-application`.
