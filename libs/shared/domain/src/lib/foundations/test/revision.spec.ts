import { Revision } from '../revision';

describe('Revision', () => {
  it('starts a new entity at 1, which already counts its first changes', () => {
    const revision = Revision.initial();

    revision.increment();

    expect(revision.value).toBe(1);
  });

  it('increments once for every change between two saves', () => {
    const revision = Revision.restore(4);

    revision.increment();
    revision.increment();

    expect(revision.value).toBe(5);
  });

  it('increments again for a change after a save', () => {
    const revision = Revision.initial();
    revision.markPersisted();
    revision.increment();
    expect(revision.value).toBe(2);

    revision.markPersisted();
    revision.increment();
    revision.increment();
    expect(revision.value).toBe(3);
  });

  it('keeps a restored revision until something changes', () => {
    const revision = Revision.restore(4);

    revision.markPersisted();

    expect(revision.value).toBe(4);
  });

  it('stays at 1 when fixed', () => {
    const revision = Revision.fixed();

    revision.increment();
    revision.markPersisted();
    revision.increment();

    expect(revision.value).toBe(1);
  });
});
