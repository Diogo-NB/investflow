import type { OfferSummary } from '../models/offer.types';
import { todayInSaoPaulo } from '../../dates/calendar-date';
import { offerEdit, offerFormSchema, offerValues } from './offer-form';

const offer: OfferSummary = {
  id: 'offer',
  titleType: 'CDB',
  name: 'CDB 110% do CDI',
  issuerName: 'Banco Local',
  maturityDate: '2028-12-29',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
  origin: 'OWN',
  revision: 4,
};

describe('offerEdit', () => {
  it('sends only the changed fields with the edited revision', () => {
    expect(
      offerEdit(offer, {
        ...offerValues(offer),
        name: ' CDB 112% do CDI ',
        issuerName: '',
        rate: '112',
      }),
    ).toEqual({
      revision: 4,
      name: 'CDB 112% do CDI',
      issuerName: null,
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.12' },
    });
  });

  it('treats a value typed differently but equal as unchanged', () => {
    expect(
      offerEdit(offer, {
        ...offerValues(offer),
        rate: '110,00',
        name: 'CDB 110% do CDI ',
      }),
    ).toEqual({ revision: 4 });
  });
});

describe('offerFormSchema', () => {
  it('requires a name', () => {
    const result = offerFormSchema.safeParse({
      ...offerValues(offer),
      name: '  ',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['name']]);
  });

  it('rejects a maturity outside the years the page accepts', () => {
    const year = Number(todayInSaoPaulo().slice(0, 4));
    const result = offerFormSchema.safeParse({
      ...offerValues(offer),
      maturityDate: `${year + 101}-01-02`,
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['maturityDate'],
        message: `Use datas entre 01/01/${year - 100} e 31/12/${year + 100}.`,
      }),
    ]);
  });
});
