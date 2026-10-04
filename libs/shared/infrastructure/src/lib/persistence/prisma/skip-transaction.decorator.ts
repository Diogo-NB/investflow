import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSACTION_KEY = 'SKIP_TRANSACTION';

export const SkipTransaction = () => SetMetadata(SKIP_TRANSACTION_KEY, true);
