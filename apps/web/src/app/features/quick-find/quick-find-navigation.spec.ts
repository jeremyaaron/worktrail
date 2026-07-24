import type {
  QuickFindAttachmentResultDto,
  QuickFindCycleResultDto,
  QuickFindMilestoneResultDto,
  QuickFindProjectContextDto,
  QuickFindProjectResultDto,
  QuickFindReportResultDto,
  QuickFindResultDto,
  QuickFindWorkItemContextDto,
  QuickFindWorkItemResultDto
} from '@worktrail/contracts';

import type { QuickFindSelectableOption } from './quick-find-model';
import {
  quickFindCurrentProjectNavigationEntries,
  quickFindGlobalNavigationEntries,
  quickFindResultDestination,
  quickFindResultOptionId,
  quickFindWorkItemOverflowDestination
} from './quick-find-navigation';

describe('Quick Find navigation', () => {
  const project: QuickFindProjectContextDto = {
    id: '20000000-0000-4000-8000-000000000001',
    key: 'WT',
    name: 'Worktrail',
    status: 'active'
  };
  const workItem: QuickFindWorkItemContextDto = {
    id: '30000000-0000-4000-8000-000000000001',
    displayKey: 'WT-42',
    title: 'Release evidence',
    status: 'in_progress',
    type: 'task'
  };
  const projectResult: QuickFindProjectResultDto = {
    kind: 'project',
    project,
    match: { field: 'project_name', mode: 'prefix', excerpt: null }
  };
  const workItemResult: QuickFindWorkItemResultDto = {
    kind: 'work_item',
    project,
    workItem,
    match: { field: 'work_item_title', mode: 'exact', excerpt: null }
  };
  const milestoneResult: QuickFindMilestoneResultDto = {
    kind: 'milestone',
    project,
    milestone: {
      id: '40000000-0000-4000-8000-000000000001',
      name: 'Release',
      status: 'active',
      targetDate: '2026-08-01',
      isArchived: false
    },
    match: { field: 'milestone_name', mode: 'prefix', excerpt: null }
  };
  const cycleResult: QuickFindCycleResultDto = {
    kind: 'cycle',
    project,
    cycle: {
      id: '50000000-0000-4000-8000-000000000001',
      name: 'Release cycle',
      status: 'active',
      startDate: '2026-07-20',
      endDate: '2026-08-01',
      isArchived: false
    },
    match: { field: 'cycle_name', mode: 'prefix', excerpt: null }
  };
  const reportResult: QuickFindReportResultDto = {
    kind: 'report',
    project,
    report: {
      id: '60000000-0000-4000-8000-000000000001',
      title: 'Release report',
      statusDate: '2026-07-23',
      health: 'healthy',
      publishedAt: '2026-07-23T12:00:00.000Z'
    },
    match: { field: 'report_title', mode: 'prefix', excerpt: null }
  };
  const attachmentResult: QuickFindAttachmentResultDto = {
    kind: 'attachment',
    project,
    workItem,
    attachment: {
      id: '70000000-0000-4000-8000-000000000001',
      fileName: 'release-evidence.pdf',
      byteSize: 2048,
      createdAt: '2026-07-22T15:30:00.000Z'
    },
    match: { field: 'attachment_file_name', mode: 'prefix', excerpt: null }
  };

  it('maps every result kind to its canonical destination', () => {
    const cases: ReadonlyArray<{
      result: QuickFindResultDto;
      commands: readonly string[];
    }> = [
      { result: projectResult, commands: ['/projects', project.id] },
      { result: workItemResult, commands: ['/work-items', workItem.id] },
      {
        result: milestoneResult,
        commands: ['/projects', project.id, 'milestones', milestoneResult.milestone.id]
      },
      {
        result: cycleResult,
        commands: ['/projects', project.id, 'cycles', cycleResult.cycle.id]
      },
      {
        result: reportResult,
        commands: ['/projects', project.id, 'status', reportResult.report.id]
      },
      { result: attachmentResult, commands: ['/work-items', workItem.id] }
    ];

    for (const testCase of cases) {
      expect(quickFindResultDestination(testCase.result).commands).toEqual(testCase.commands);
    }
  });

  it('maps attachments to the owning work item Files fragment only', () => {
    expect(quickFindResultDestination(attachmentResult)).toEqual({
      commands: ['/work-items', workItem.id],
      fragment: 'files'
    });
    expect(quickFindResultDestination(workItemResult).fragment).toBeUndefined();
  });

  it('derives stable option ids from kind and entity identity', () => {
    expect(quickFindResultOptionId(projectResult)).toBe(`quick-find-project-${project.id}`);
    expect(quickFindResultOptionId(workItemResult)).toBe(
      `quick-find-work-item-${workItem.id}`
    );
    expect(quickFindResultOptionId(milestoneResult)).toBe(
      `quick-find-milestone-${milestoneResult.milestone.id}`
    );
    expect(quickFindResultOptionId(cycleResult)).toBe(
      `quick-find-cycle-${cycleResult.cycle.id}`
    );
    expect(quickFindResultOptionId(reportResult)).toBe(
      `quick-find-report-${reportResult.report.id}`
    );
    expect(quickFindResultOptionId(attachmentResult)).toBe(
      `quick-find-attachment-${attachmentResult.attachment.id}`
    );
  });

  it('provides fixed global navigation entries in product order', () => {
    expect(quickFindGlobalNavigationEntries.map((entry) => entry.label)).toEqual([
      'My Work',
      'Inbox',
      'Work Items',
      'Projects',
      'Portfolio',
      'Create work item'
    ]);
    expect(quickFindGlobalNavigationEntries.map((entry) => entry.commands)).toEqual([
      ['/my-work'],
      ['/inbox'],
      ['/work-items'],
      ['/projects'],
      ['/portfolio'],
      ['/work-items/new']
    ]);
  });

  it('provides project destinations only when project context exists', () => {
    expect(quickFindCurrentProjectNavigationEntries(null)).toEqual([]);

    const entries = quickFindCurrentProjectNavigationEntries(project.id);

    expect(entries.map((entry) => entry.label)).toEqual([
      'Project overview',
      'Work',
      'Board',
      'Planning',
      'Reports',
      'Project settings'
    ]);
    expect(entries.map((entry) => entry.commands)).toEqual([
      ['/projects', project.id],
      ['/projects', project.id, 'work-items'],
      ['/projects', project.id, 'board'],
      ['/projects', project.id, 'planning'],
      ['/projects', project.id, 'status'],
      ['/projects', project.id, 'settings']
    ]);
  });

  it('serializes work-item overflow through the canonical workspace query contract', () => {
    const destination = quickFindWorkItemOverflowDestination('release evidence');

    expect(destination).toEqual({
      commands: ['/work-items'],
      queryParams: {
        search: 'release evidence',
        archivedProjects: 'include'
      }
    });
    expect(destination.queryParams?.['page']).toBeUndefined();
    expect(destination.queryParams?.['pageSize']).toBeUndefined();
    expect(destination.queryParams?.['sort']).toBeUndefined();
  });

  it('defines selectable navigation, result, and work-item overflow models', () => {
    const options: QuickFindSelectableOption[] = [
      { type: 'navigation', entry: quickFindGlobalNavigationEntries[0] },
      { type: 'result', result: workItemResult },
      { type: 'work_item_overflow', query: 'release evidence' }
    ];

    expect(options.map((option) => option.type)).toEqual([
      'navigation',
      'result',
      'work_item_overflow'
    ]);
  });
});
