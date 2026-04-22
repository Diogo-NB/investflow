import {
  AggregateRoot,
  AggregateRootProps,
  DateRange,
  InvestmentType,
  Money,
  Rate,
} from '@investflow/shared-domain';
import {
  InvalidProductTransitionError,
  ProductNotFoundError,
  ProductNotOpenError,
} from '../../errors/product-domain.errors';
import { ProductClosedEvent } from '../../events/product-closed.event';
import { ProductPublishedEvent } from '../../events/product-published.event';
import { Indexer } from '../../value-objects/indexer/indexer.vo';
import { ProductStatus } from '../../value-objects/product-status/product-status.enum';

export interface InvestmentProductProps extends AggregateRootProps {
  organizationId: string;
  name: string;
  type: InvestmentType;
  indexer: Indexer;
  rate: Rate;
  period: DateRange;
  minimumAmount: Money;
  totalVolume: Money;
  status: ProductStatus;
}

export class InvestmentProduct extends AggregateRoot {
  readonly organizationId: string;
  readonly name: string;
  readonly type: InvestmentType;
  readonly indexer: Indexer;
  readonly rate: Rate;
  readonly period: DateRange;
  readonly minimumAmount: Money;
  readonly totalVolume: Money;
  private _status: ProductStatus;

  private constructor(props: InvestmentProductProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.type = props.type;
    this.indexer = props.indexer;
    this.rate = props.rate;
    this.period = props.period;
    this.minimumAmount = props.minimumAmount;
    this.totalVolume = props.totalVolume;
    this._status = props.status;
  }

  get status(): ProductStatus {
    return this._status;
  }

  static create(
    props: Omit<
      InvestmentProductProps,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    > & { id?: string },
  ): InvestmentProduct {
    const now = new Date();
    return new InvestmentProduct({
      ...props,
      id: props.id ?? crypto.randomUUID(),
      status: ProductStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: InvestmentProductProps): InvestmentProduct {
    return new InvestmentProduct(props);
  }

  publish(): this {
    if (this._status !== ProductStatus.DRAFT) {
      throw new InvalidProductTransitionError(this._status, ProductStatus.OPEN);
    }
    this._status = ProductStatus.OPEN;
    this.updatedAt = new Date();
    this.apply(
      new ProductPublishedEvent(
        this.id,
        this.organizationId,
        this.type,
        this.rate.value,
        this.totalVolume.amount,
      ),
    );
    return this;
  }

  validateAcceptsOrders(): this {
    if (this._status !== ProductStatus.OPEN) {
      throw new ProductNotOpenError(this._status);
    }
    return this;
  }

  close(): this {
    if (this._status !== ProductStatus.OPEN) {
      throw new InvalidProductTransitionError(
        this._status,
        ProductStatus.CLOSED,
      );
    }
    this._status = ProductStatus.CLOSED;
    this.updatedAt = new Date();
    this.apply(new ProductClosedEvent(this.id, this.organizationId));
    return this;
  }
}

export { ProductNotFoundError };
