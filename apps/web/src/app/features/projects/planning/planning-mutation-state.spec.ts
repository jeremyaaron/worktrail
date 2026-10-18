import { PlanningMutationState } from './planning-mutation-state';
import { populatedRiskSections } from './risk-display';

describe('Planning record state', () => {
  it('serializes writes and retains unrelated record feedback until a context reset', () => {
    const state = new PlanningMutationState();
    expect(state.begin('a')).toBeTrue();
    expect(state.begin('b')).toBeFalse();
    state.fail('a', 'Retain this failure');
    expect(state.begin('b')).toBeTrue();
    state.succeed('b', 'Saved');
    expect(state.errors()['a']).toBe('Retain this failure');
    expect(state.messages()['b']).toBe('Saved');
    expect(state.pendingId()).toBeNull();
    state.reset();
    expect(state.errors()).toEqual({});
    expect(state.messages()).toEqual({});
  });

  it('uses authoritative nonzero counts rather than preview length to disclose risks', () => {
    const sections = [{ count: 0, items: ['stale preview'] }, { count: 12, items: [] }, { count: 1, items: ['preview'] }];
    expect(populatedRiskSections(sections)).toEqual(sections.slice(1));
    expect(sections).toHaveSize(3);
  });
});
