import { Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  HttpResultInterceptor,
  TransactionInterceptor,
} from '@investflow/shared-infrastructure';

// Unwrap failed Results inside the transaction so they trigger rollback.
export const HTTP_INTERCEPTOR_PROVIDERS: Provider[] = [
  { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
  { provide: APP_INTERCEPTOR, useClass: HttpResultInterceptor },
];
