export * from './lib/shared-infrastructure.module';
export { ClockModule } from './lib/clocks/clock.module';
export { environmentConfig } from './lib/config/environment-config';
export { awsConfig, type AwsConfig } from './lib/aws/aws.config';
export { JwtAuthGuard } from './lib/authentication/jwt-auth.guard';
export { Public } from './lib/authentication/public.decorator';
export { CurrentUser } from './lib/authentication/current-user.decorator';
export { BaseRepository } from './lib/persistence/base.repository';
export {
  RepositoryFindError,
  RepositorySaveError,
} from './lib/persistence/repository.error';
export { PrismaModule } from './lib/persistence/prisma/prisma.module';
export { PrismaService } from './lib/persistence/prisma/prisma.service';
export {
  databaseConfig,
  type DatabaseConfig,
} from './lib/persistence/prisma/database.config';
export type { TransactionalPrismaClient } from './lib/persistence/prisma/prisma-client.type';
export { SkipTransaction } from './lib/persistence/prisma/skip-transaction.decorator';
export { TransactionInterceptor } from './lib/persistence/prisma/transaction.interceptor';
export { UnitOfWork } from './lib/persistence/unit-of-work';
export { TransactionalDomainEventRecorder } from './lib/messaging/outbox/transactional-domain-event-recorder';
export {
  formatUtcInstantDatePtBr,
  formatUtcInstantDateTimePtBr,
} from './lib/dates/temporal.formatter';
export {
  formatMoney,
  formatMoneyPtBr,
  type MoneyFormatOptions,
} from './lib/money/money.formatter';
export { OutboxModule } from './lib/messaging/outbox/outbox.module';
export {
  outboxConfig,
  type OutboxConfig,
} from './lib/messaging/outbox/outbox.config';
export { OutboxPollerService } from './lib/messaging/outbox/outbox-poller.service';
export {
  MessageBroker,
  type OutboxMessage,
  type RejectedMessage,
} from './lib/messaging/outbox/message-broker.port';
export { EventBridgeMessageBroker } from './lib/messaging/eventbridge/eventbridge-message-broker';
export {
  eventBridgeConfig,
  type EventBridgeConfig,
} from './lib/messaging/eventbridge/eventbridge.config';
export { OnEvent } from './lib/messaging/consumers/on-event.decorator';
export {
  SqsConsumersModule,
  type SqsConsumerBinding,
} from './lib/messaging/sqs/sqs-consumers.module';
export { AppExceptionFilter } from './lib/http/app-exception.filter';
export { HttpResultInterceptor } from './lib/http/http-result.interceptor';
export { createRequestValidationPipe } from './lib/http/request-validation.pipe';
export {
  IS_CALENDAR_DATE,
  IsCalendarDate,
  isCalendarDate,
} from './lib/dates/calendar-date.validator';
