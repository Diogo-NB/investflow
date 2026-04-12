import { DomainError, NotFoundError } from '@investflow/shared-domain';

export class InvalidIndexerError extends DomainError {
  constructor(message: string) {
    super(`Invalid indexer configuration: ${message}`);
  }
}

export class InvalidProductTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Cannot transition InvestmentProduct from ${from} to ${to}`);
  }
}

export class ProductNotOpenError extends DomainError {
  constructor(status: string) {
    super(`InvestmentProduct is not OPEN (current status: ${status})`);
  }
}

export class ProductNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`InvestmentProduct not found: ${id}`);
  }
}
