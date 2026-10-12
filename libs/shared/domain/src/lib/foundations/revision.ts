// Numbers the persisted states of an entity for optimistic concurrency. All
// changes between two saves share one new revision, so a revision always
// names exactly one persisted state. Mutable: the owning entity holds one
// instance and changes it from its behavior methods.
export class Revision {
  private constructor(
    private current: number,
    // The revision as last read or saved; 0 when never saved.
    private original: number,
    private readonly isFixed = false,
  ) {}

  // For entities without optimistic concurrency: always 1.
  static fixed(): Revision {
    return new Revision(1, 1, true);
  }

  // A new entity is its own first revision.
  static initial(): Revision {
    return new Revision(1, 0);
  }

  static restore(stored: number): Revision {
    return new Revision(stored, stored);
  }

  get value(): number {
    return this.current;
  }

  increment(): void {
    if (this.isFixed || this.current !== this.original) return;
    this.current += 1;
  }

  markPersisted(): void {
    this.original = this.current;
  }
}
