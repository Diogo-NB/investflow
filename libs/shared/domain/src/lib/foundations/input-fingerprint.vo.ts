import { ValueObject } from './value-object.base';

export type InputVersion = string | number | null;

// The versions of the inputs a derived value was computed from. The value is
// current exactly when its recorded fingerprint equals the one built from the
// current versions; fingerprints are compared, never parsed.
export class InputFingerprint extends ValueObject<InputFingerprint> {
  private constructor(private readonly value: string) {
    super();
  }

  // Entries are encoded in insertion order, so each derivation builds its
  // fingerprint in one place. A new input or a changed meaning takes a new
  // encoding, which makes every recorded fingerprint differ.
  static of(
    encoding: number,
    versions: Readonly<Record<string, InputVersion>>,
  ): InputFingerprint {
    const entries = Object.entries(versions).map(
      ([name, version]) => `${name}:${JSON.stringify(version)}`,
    );
    return new InputFingerprint([`v${encoding}`, ...entries].join('|'));
  }

  static restore(stored: string): InputFingerprint {
    return new InputFingerprint(stored);
  }

  override toString(): string {
    return this.value;
  }

  equals(other: InputFingerprint): boolean {
    return this.value === other.value;
  }
}
