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

## Handler Orchestration

- Use simple classes with one `execute(input)` method.
- Controllers and listeners inject use-case or query-handler classes directly.
- Do not add command buses, query buses, or `@nestjs/cqrs` unless explicitly
  requested.
- Shared compile-time handler contracts live in
  `@investflow/shared-application`.
