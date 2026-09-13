export * from './lib/shared-infrastructure.module';
export { ClockModule } from './lib/clock/clock.module';
export { PrismaModule } from './lib/prisma/prisma.module';
export { PrismaService } from './lib/prisma/prisma.service';
export type { TransactionalPrismaClient } from './lib/prisma/prisma-client.type';
export { SkipTransaction } from './lib/prisma/skip-transaction.decorator';
export { JwtAuthGuard } from './lib/auth/jwt-auth.guard';
export { RolesGuard } from './lib/auth/roles.guard';
export { Public } from './lib/auth/public.decorator';
export { Roles } from './lib/auth/roles.decorator';
export { CurrentUser } from './lib/auth/current-user.decorator';
export { BaseRepository } from './lib/base.repository';
export { RepositorySaveError } from './lib/errors/repository.error';
export {
  formatUtcInstantDatePtBr,
  formatUtcInstantDateTimePtBr,
} from './lib/formatters/temporal.formatter';
export {
  formatMoney,
  formatMoneyPtBr,
  type MoneyFormatOptions,
} from './lib/formatters/money.formatter';
export { MessageBroker } from './lib/outbox/message-broker.port';
export { SnsMessageBroker } from './lib/outbox/sns-message-broker';
export { OutboxTopicRegistry } from './lib/outbox/outbox-topic.registry';
export { HttpResultPresenter } from './lib/presenters/http-result.presenter';
export { SqsConsumerBase } from './lib/sqs/sqs-consumer.base';
export { OnEvent } from './lib/sqs/on-event.decorator';
export { AppExceptionFilter } from './lib/filters/app-exception.filter';
