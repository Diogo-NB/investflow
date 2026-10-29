import { InputFingerprint } from '../input-fingerprint.vo';

describe('InputFingerprint', () => {
  it('is equal for the same versions', () => {
    const a = InputFingerprint.of(1, { simulation: 4, methodology: 'v1' });
    const b = InputFingerprint.of(1, { simulation: 4, methodology: 'v1' });

    expect(a.equals(b)).toBe(true);
  });

  it('differs when any version differs', () => {
    const a = InputFingerprint.of(1, { simulation: 4, curve: 19 });

    expect(a.equals(InputFingerprint.of(1, { simulation: 5, curve: 19 }))).toBe(
      false,
    );
    expect(a.equals(InputFingerprint.of(1, { simulation: 4, curve: 20 }))).toBe(
      false,
    );
  });

  it('tells a missing version from the same text', () => {
    const missing = InputFingerprint.of(1, { curve: null });

    expect(missing.equals(InputFingerprint.of(1, { curve: 'null' }))).toBe(
      false,
    );
  });

  it('tells a number from the same text', () => {
    const number = InputFingerprint.of(1, { curve: 19 });

    expect(number.equals(InputFingerprint.of(1, { curve: '19' }))).toBe(false);
  });

  it('keeps a separator inside a version from matching other inputs', () => {
    const one = InputFingerprint.of(1, { a: 'x|b:"y"' });

    expect(one.equals(InputFingerprint.of(1, { a: 'x', b: 'y' }))).toBe(false);
  });

  it('differs for another encoding', () => {
    const versions = { simulation: 4 };

    expect(
      InputFingerprint.of(1, versions).equals(InputFingerprint.of(2, versions)),
    ).toBe(false);
  });

  it('is restored from its stored form', () => {
    const fingerprint = InputFingerprint.of(1, { simulation: 4, curve: null });

    expect(
      InputFingerprint.restore(fingerprint.toString()).equals(fingerprint),
    ).toBe(true);
  });
});
