import type { ProjectCycleDto } from '@worktrail/contracts';

import { cycleOptionsFromDtos } from './cycle-options';

const baseCycle: ProjectCycleDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  projectId: '10000000-0000-4000-8000-000000000201',
  name: 'v0.2.1',
  goal: 'Cycle planning',
  status: 'active',
  startDate: '2026-07-13',
  endDate: '2026-07-24',
  targetPoints: 20,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

describe('cycle option helpers', () => {
  it('sorts cycle options by start date and applies display labels', () => {
    const options = cycleOptionsFromDtos([
      baseCycle,
      {
        ...baseCycle,
        id: '10000000-0000-4000-8000-000000000702',
        name: 'v0.2.0',
        status: 'completed',
        startDate: '2026-06-29',
        endDate: '2026-07-10'
      }
    ]);

    expect(options).toEqual([
      jasmine.objectContaining({
        id: '10000000-0000-4000-8000-000000000702',
        label: 'v0.2.0',
        statusLabel: 'Completed',
        dateRangeLabel: 'Jun 29, 2026 - Jul 10, 2026',
        isArchived: false
      }),
      jasmine.objectContaining({
        id: '10000000-0000-4000-8000-000000000701',
        label: 'v0.2.1',
        statusLabel: 'Active',
        dateRangeLabel: 'Jul 13, 2026 - Jul 24, 2026'
      })
    ]);
  });
});
