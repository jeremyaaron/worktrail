import { signal } from '@angular/core';

// Local to an editor: only revision numbers and callbacks leave this owner.
export class DraftTracker<T> {
  private baseline: string | null = null;
  private lastValue = '';
  private counter = 0;
  private readonly baselineRevision = signal(0);

  constructor(private readonly value: () => T) {}

  accept(value: T = this.value()): void {
    this.baseline = JSON.stringify(value);
    this.counter += 1;
    this.baselineRevision.update((revision) => revision + 1);
  }

  meaningful(): boolean {
    this.baselineRevision();
    return this.baseline !== null && JSON.stringify(this.value()) !== this.baseline;
  }

  revision(): number {
    const value = JSON.stringify(this.value());
    if (value !== this.lastValue) { this.lastValue = value; this.counter += 1; }
    return this.counter;
  }
}
