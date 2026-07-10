import { cycleDateRangeLabel, cycleHealthLabel, cycleStatusLabel } from './cycle-display';

describe('cycle display helpers', () => {
  it('formats cycle statuses and health states for product display', () => {
    expect(cycleStatusLabel('planned')).toBe('Planned');
    expect(cycleStatusLabel('active')).toBe('Active');
    expect(cycleStatusLabel('completed')).toBe('Completed');
    expect(cycleStatusLabel('canceled')).toBe('Canceled');
    expect(cycleHealthLabel('at_risk')).toBe('At risk');
  });

  it('formats cycle date windows', () => {
    expect(
      cycleDateRangeLabel({
        startDate: '2026-07-13',
        endDate: '2026-07-24'
      })
    ).toBe('Jul 13, 2026 - Jul 24, 2026');
  });
});
