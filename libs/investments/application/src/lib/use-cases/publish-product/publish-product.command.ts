export class PublishProductCommand {
  constructor(readonly props: { productId: string; organizationId: string }) {}
}
