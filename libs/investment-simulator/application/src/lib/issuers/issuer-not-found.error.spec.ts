import { EAppErrorCode } from '@investflow/shared-domain';
import { IssuerNotFoundError } from './issuer-not-found.error';

describe('IssuerNotFoundError', () => {
  it('describes a missing issuer', () => {
    const error = new IssuerNotFoundError('issuer-id');

    expect(error.code).toBe(EAppErrorCode.ISSUER_NOT_FOUND);
    expect(error.kind).toBe('not-found');
    expect(error.metadata).toEqual({ issuerId: 'issuer-id' });
  });
});
