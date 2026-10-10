import { EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { ListIssuersQueryHandler } from './list-issuers.query-handler';
import { IssuerController } from '../http/issuer.controller';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

it('lists issuer lookup fields in a stable order without requiring offers', async () => {
  const findMany = jest
    .fn()
    .mockResolvedValue([{ id: 'issuer-id', name: 'Banco Local' }]);
  const handler = new ListIssuersQueryHandler({
    client: { investmentIssuer: { findMany } },
  } as unknown as PrismaService);
  const result = await new IssuerController(handler).list();
  expect(findMany).toHaveBeenCalledWith({
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  expect(result.value).toEqual([{ id: 'issuer-id', name: 'Banco Local' }]);
  findMany.mockResolvedValue([]);
  expect((await handler.execute()).value).toEqual([]);
  findMany.mockRejectedValue(new Error('database'));
  expect((await handler.execute()).error.code).toBe(
    EAppErrorCode.ISSUER_QUERY_FAILED,
  );
});
