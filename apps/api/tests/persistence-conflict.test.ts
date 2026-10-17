import { describe, expect, it } from 'vitest';

import {
  cycleConstraintConflicts, labelConstraintConflicts, milestoneConstraintConflicts,
  projectConstraintConflicts, rethrowConstraintConflict
} from '../src/errors/persistence-conflict.js';

const conflicts = { ...cycleConstraintConflicts, ...labelConstraintConflicts, ...milestoneConstraintConflicts, ...projectConstraintConflicts };

describe('known persistence constraint conflicts', () => {
  it.each(Object.entries(conflicts))('maps %s without exposing database detail', (constraint, message) => {
    const error = { cause: { code: '23505', constraint, detail: 'private database values' } };
    expect(() => rethrowConstraintConflict(error, conflicts)).toThrow(message);
    try { rethrowConstraintConflict(error, conflicts); } catch (mapped) {
      expect(mapped).toMatchObject({ code: 'CONFLICT', status: 409, message });
      expect(JSON.stringify(mapped)).not.toContain('private database values');
    }
  });

  it.each([{ code: '23505', constraint: 'unrelated_index' }, { code: '23503', constraint: 'project_cycles_project_id_active_unique' },
    new Error('storage failure'), null])('preserves unrelated failures unchanged (%j)', (error) => {
    let caught: unknown;
    try { rethrowConstraintConflict(error, cycleConstraintConflicts); } catch (value) { caught = value; }
    expect(caught).toBe(error);
  });

  it('does not loop on a malformed cyclic cause', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(() => rethrowConstraintConflict(error, cycleConstraintConflicts)).toThrow();
  });
});
