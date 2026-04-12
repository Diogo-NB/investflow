import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@investflow/shared-infrastructure';

export class GetProductQuery {
  constructor(
    readonly productId: string,
    readonly organizationId: string,
  ) {}
}

@Injectable()
export class GetProductQueryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProductQuery): Promise<{
    id: string;
    organizationId: string;
    name: string;
    type: string;
    indexerType: string;
    indexerPercentageOfIndex: string | null;
    indexerSpread: string | null;
    rateValue: string;
    rateReferenceType: string;
    startDate: Date;
    endDate: Date;
    minimumAmount: string;
    totalVolume: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const row = await this.prisma.client.investmentProduct.findUnique({
      where: { id: query.productId, organizationId: query.organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        type: true,
        indexerType: true,
        indexerPct: true,
        indexerSpread: true,
        rateValue: true,
        rateRefType: true,
        startDate: true,
        endDate: true,
        minimumAmount: true,
        totalVolume: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) throw new NotFoundException(`Product ${query.productId} not found`);

    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      type: row.type,
      indexerType: row.indexerType,
      indexerPercentageOfIndex: row.indexerPct?.toString() ?? null,
      indexerSpread: row.indexerSpread?.toString() ?? null,
      rateValue: row.rateValue.toString(),
      rateReferenceType: row.rateRefType,
      startDate: row.startDate,
      endDate: row.endDate,
      minimumAmount: row.minimumAmount.toString(),
      totalVolume: row.totalVolume.toString(),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
