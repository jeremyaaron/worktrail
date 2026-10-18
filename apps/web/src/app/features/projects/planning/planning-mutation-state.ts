import { signal } from '@angular/core';

// Page-local feedback for independent records; request lifetime belongs to PageContext.
export class PlanningMutationState {
  readonly pendingId = signal<string | null>(null);
  readonly errors = signal<Record<string, string>>({});
  readonly messages = signal<Record<string, string>>({});

  begin(id: string): boolean {
    if (this.pendingId() !== null) return false;
    this.pendingId.set(id);
    this.errors.update(values => ({ ...values, [id]: '' }));
    this.messages.update(values => ({ ...values, [id]: '' }));
    return true;
  }

  fail(id: string, message: string): void {
    this.errors.update(values => ({ ...values, [id]: message }));
    if (this.pendingId() === id) this.pendingId.set(null);
  }

  succeed(id: string, message: string): void {
    this.errors.update(values => ({ ...values, [id]: '' }));
    this.messages.update(values => ({ ...values, [id]: message }));
    if (this.pendingId() === id) this.pendingId.set(null);
  }

  reset(): void {
    this.pendingId.set(null);
    this.errors.set({});
    this.messages.set({});
  }
}
