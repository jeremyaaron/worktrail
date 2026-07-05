import { memberDisplayName } from './member-display';
import { formatToken } from './token-format';

describe('display helpers', () => {
  it('formats inactive member names explicitly', () => {
    expect(memberDisplayName({ name: 'Jordan Reviewer', isActive: true })).toBe(
      'Jordan Reviewer'
    );
    expect(memberDisplayName({ name: 'Riley Alumni', isActive: false })).toBe(
      'Riley Alumni (inactive)'
    );
  });

  it('formats enum tokens as compact display text', () => {
    expect(formatToken('in_progress')).toBe('in progress');
    expect(formatToken('dependency_blocked')).toBe('dependency blocked');
  });
});
