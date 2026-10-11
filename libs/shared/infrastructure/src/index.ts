export * from './lib/shared-infrastructure.module';
export { ClockModule } from './lib/clocks/clock.module';
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
export type { TransactionalPrismaClient } from './lib/persistence/prisma/prisma-client.type';
export { SkipTransaction } from './lib/persistence/prisma/skip-transaction.decorator';
export { TransactionInterceptor } from './lib/persistence/prisma/transaction.interceptor';
export { TransactionContext } from './lib/persistence/prisma/transaction.context';
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
