import { AggregateRoot, generateUuid } from '@investflow/shared-domain';

interface IssuerProps {
  readonly name: string;
}

export type CreateIssuerProps = IssuerProps;

export interface ReconstituteIssuerProps extends IssuerProps {
  readonly id: string;
}

export class Issuer extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: IssuerProps,
  ) {
    super(id);
  }

  static create(props: CreateIssuerProps): Issuer {
    return new Issuer(generateUuid(), { name: props.name });
  }

  static reconstitute(props: ReconstituteIssuerProps): Issuer {
    return new Issuer(props.id, { name: props.name });
  }

  get name(): string {
    return this.props.name;
  }
}
