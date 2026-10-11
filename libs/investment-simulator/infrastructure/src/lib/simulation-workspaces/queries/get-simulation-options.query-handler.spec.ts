import { EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { GetSimulationOptionsQueryHandler } from './get-simulation-options.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function setup() {
  const curves = [
    {
      id: 'cdi',
      name: 'CDI Local',
      description: null,
      index: 'CDI',
      intervals: [
        { startDate: date('2024-01-01'), endDate: date('2026-12-31') },
        { startDate: date('2027-01-01'), endDate: date('2028-12-31') },
      ],
    },
  ];
  const offer = (id: string, titleType: string, remunerationType: string) => ({
    id,
    titleType,
    issuerName: 'Banco Local',
    maturityDate: date('2028-12-31'),
    redemptionType: 'DAILY',
    remunerationType,
    rateValue: new Prisma.Decimal('1.10'),
  });
  const offers = [
    offer('cdb', 'CDB', 'CDI_PERCENTAGE'),
    offer('ipca', 'CDB', 'IPCA_PLUS'),
    offer('lci', 'LCI', 'PREFIXED'),
  ];
  const client = {
    indexCurve: { findMany: jest.fn().mockResolvedValue(curves) },
    investmentOffer: { findMany: jest.fn().mockResolvedValue(offers) },
  };
  return {
    client,
    handler: new GetSimulationOptionsQueryHandler({
      client,
    } as unknown as PrismaService),
  };
}

describe('GetSimulationOptionsQueryHandler', () => {
  it('pairs each remuneration kind with its index, curves and support', async () => {
    const { handler } = setup();

    const { remunerations } = (await handler.execute()).value;

    expect(remunerations).toEqual([
      { kind: 'PREFIXED', index: null, unsupportedReason: null, curves: [] },
      {
        kind: 'CDI_PERCENTAGE',
        index: 'CDI',
        unsupportedReason: null,
        curves: [
          {
            id: 'cdi',
            name: 'CDI Local',
            description: null,
            coverage: { startDate: '2024-01-01', endDate: '2028-12-31' },
          },
        ],
      },
      {
        kind: 'SELIC_PERCENTAGE',
        index: 'SELIC',
        unsupportedReason: null,
        curves: [],
      },
      {
        kind: 'IPCA_PLUS',
        index: 'IPCA',
        unsupportedReason: EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED,
        curves: [],
      },
    ]);
  });

  it('flags catalog offers the calculator cannot price', async () => {
    const { client, handler } = setup();

    const { offers } = (await handler.execute()).value;

    expect(client.investmentOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      }),
    );
    expect(client.indexCurve.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
    expect(offers.map((offer) => [offer.id, offer.unsupportedReason])).toEqual([
      ['cdb', null],
      ['ipca', EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED],
      ['lci', null],
    ]);
    expect(offers[0]).toMatchObject({
      maturityDate: '2028-12-31',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
    });
  });

  it('publishes the domain tax tables as plain data', async () => {
    const { taxRules, titleTypes } = (await setup().handler.execute()).value;

    expect(titleTypes).toEqual([
      { titleType: 'CDB', incomeTaxExempt: false, minimumTermMonths: null },
      { titleType: 'LCI', incomeTaxExempt: true, minimumTermMonths: 9 },
      { titleType: 'LCA', incomeTaxExempt: true, minimumTermMonths: 9 },
    ]);

    expect(taxRules.iof.exemptFromCalendarDays).toBe(30);
    expect(taxRules.iof.dailyRates).toHaveLength(29);
    expect(taxRules.iof.dailyRates[9]).toEqual({
      calendarDay: 10,
      rate: '0.66',
    });
    expect(taxRules.incomeTax.brackets).toEqual([
      { fromCalendarDays: 1, upToCalendarDays: 180, rate: '0.225' },
      { fromCalendarDays: 181, upToCalendarDays: 360, rate: '0.2' },
      { fromCalendarDays: 361, upToCalendarDays: 720, rate: '0.175' },
      { fromCalendarDays: 721, upToCalendarDays: null, rate: '0.15' },
    ]);
  });

  it('maps read failures to a query error', async () => {
    const { client, handler } = setup();
    client.indexCurve.findMany.mockRejectedValue(new Error('database'));

    expect((await handler.execute()).error.code).toBe(
      EAppErrorCode.SIMULATION_WORKSPACE_QUERY_FAILED,
    );
  });
});
