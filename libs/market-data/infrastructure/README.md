# Market Data Infrastructure

Adapters for importing published index values: the Banco Central reader, the Prisma repository, the import job, and `MarketDataInfrastructureModule`, which needs Clock, PrismaService, UnitOfWork, and DomainEventRecorder from the host.

Consumers import its public API through `@investflow/market-data-infrastructure`.
