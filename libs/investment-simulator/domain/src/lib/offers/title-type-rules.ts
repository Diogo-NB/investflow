import { IncomeTaxPolicy } from '../taxes/income-tax-policy.domain-service';
import { ETitleType } from './title-type.enum';

export interface TitleTypeRules {
  // Identifies the calendar, formulas and taxes that produce the figures. Bump
  // it whenever they change, so recorded calculations report being outdated.
  readonly methodologyVersion: string;
  // Regulated minimum time from investment to maturity, when there is one.
  readonly minimumTermMonths: number | null;
  // Null when individuals are exempt from income tax on the earnings.
  readonly incomeTax: IncomeTaxPolicy | null;
}

const regressiveIncomeTax = new IncomeTaxPolicy();

// LCI and LCA: income tax exemption under Lei nº 11.033/2004, art. 3º, II, and
// the CMN minimum maturity for titles not updated by a price index.
export const TITLE_TYPE_RULES: Readonly<Record<ETitleType, TitleTypeRules>> = {
  [ETitleType.CDB]: {
    methodologyVersion: 'cdb-252-v1',
    minimumTermMonths: null,
    incomeTax: regressiveIncomeTax,
  },
  [ETitleType.LCI]: {
    methodologyVersion: 'lci-252-v1',
    minimumTermMonths: 9,
    incomeTax: null,
  },
  [ETitleType.LCA]: {
    methodologyVersion: 'lca-252-v1',
    minimumTermMonths: 9,
    incomeTax: null,
  },
};
