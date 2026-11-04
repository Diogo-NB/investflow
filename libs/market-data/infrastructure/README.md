# Market Data Infrastructure

Adapters for published index values, in one module per host:

- `PublishedIndexValuesImportModule`: the Banco Central reader, the Prisma repository, and the import job. It needs Clock, PrismaService, UnitOfWork, and DomainEventRecorder from the host.
- `PublishedIndexValuesHttpModule`: the endpoint with the latest value of each index. It needs PrismaService from the host.

Consumers import its public API through `@investflow/market-data-infrastructure`.
