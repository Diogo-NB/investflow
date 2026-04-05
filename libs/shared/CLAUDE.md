# Shared Kernel

Contains only genuinely transversal code used by **more than one bounded context**.

## Rule: What Belongs Here

If a type, class, or utility is used by only one bounded context, it belongs in that context — not here.

## Value Objects (shared/domain)

| Value Object | Fields | Validation |
|---|---|---|
| `Money` | `amount: Decimal`, `currency: 'BRL'` | `amount > 0` |
| `Rate` | `value: Decimal`, `referenceType: ReferenceType` | `value > 0` |
| `InvestmentType` | enum: `SELIC \| CDI \| IPCA` | — |
| `Owner` | `ownerId: UUID`, `ownerType: OwnerType` | ORG_USER requires `organizationId` |

`ReferenceType` enum: `PERCENTAGE_CDI | FIXED | IPCA_PLUS`

`OwnerType` enum: `USER | ORGANIZATION`

## Domain (shared/domain)

| Component | Responsibility |
|---|---|
| `AggregateRoot` | Base class — collects domain events via `apply()`, exposes `getDomainEvents()` / `clearDomainEvents()` |
| `DomainEvent` | Base interface for all domain events |
| `DomainError` | Base error class for domain invariant violations |

## Infrastructure (shared/infrastructure)

| Component | Responsibility |
|---|---|
| `PrismaService` | DB connection via Prisma 7 + `@prisma/adapter-pg`. `.client` getter returns transactional client from `AsyncLocalStorage` |
| `TransactionInterceptor` | Global interceptor — wraps requests in Prisma `$transaction` via `AsyncLocalStorage` |
| `BaseRepository<T>` | Abstract base for all repositories — `save()` persists aggregate state + writes domain events to `outbox_events` atomically. Subclasses implement `persistAggregate()` |
| `OutboxPollerService` | `@Cron` (5s) — reads unpublished `outbox_events`, publishes to SQS, marks `published_at` |
| `JwtAuthGuard` | Global NestJS guard — validates Keycloak JWT on every request |
| `SqsConsumerBase` | Abstract base class for SQS consumers — handles retry, DLQ, idempotency via `processed_events` table |

## Types (shared/types)

Public DTOs and contract interfaces shared between bounded contexts. These are the only types Portfolio may use from the Investments domain (re-exported here).
