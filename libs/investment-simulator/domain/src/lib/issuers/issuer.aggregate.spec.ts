import { Issuer } from './issuer.aggregate';

describe('Issuer', () => {
  it('assigns a new identity to each issuer', () => {
    const first = Issuer.create({ name: 'Banco Exemplo' });
    const second = Issuer.create({ name: 'Banco Exemplo' });

    expect(first.id).not.toBe(second.id);
  });

  it('creates an issuer with a generated UUID', () => {
    const issuer = Issuer.create({ name: 'Banco Exemplo' });

    expect(issuer.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(issuer.name).toBe('Banco Exemplo');
    expect(issuer.getDomainEvents()).toEqual([]);
  });

  it.each(['', '  Banco  ', 'bAnCo'])(
    'preserves the name exactly as received: %p',
    (name) => {
      expect(Issuer.create({ name }).name).toBe(name);
    },
  );

  it('reconstitutes an issuer with its known identity', () => {
    const issuer = Issuer.reconstitute({ id: 'issuer-id', name: 'Banco' });

    expect(issuer.id).toBe('issuer-id');
    expect(issuer.name).toBe('Banco');
  });
});
