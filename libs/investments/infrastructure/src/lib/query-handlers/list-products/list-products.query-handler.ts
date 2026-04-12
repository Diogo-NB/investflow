import { Injectable } from '@nestjs/common';
import { PrismaService } from '@investflow/shared-infrastructure';

export class ListProductsQuery {
  constructor(
    readonly organizationId: string,
    readonly status?: string,
  ) {}
}

@Injectable()
export class ListProductsQueryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProductsQuery): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      indexerType: string;
      status: string;
      minimumAmount: string;
      totalVolume: string;
      startDate: Date;
      endDate: Date;
      createdAt: Date;
    }>
  > {
    const rows = await this.prisma.client.investmentProduct.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status ? { status: query.status } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        indexerType: true,
        status: true,
        minimumAmount: true,
        totalVolume: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      indexerType: row.indexerType,
      status: row.status,
      minimumAmount: row.minimumAmount.toString(),
      totalVolume: row.totalVolume.toString(),
      startDate: row.startDate,
      endDate: row.endDate,
      createdAt: row.createdAt,
    }));
  }
}
