import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  QuickFindAttachmentResultDto,
  QuickFindCycleResultDto,
  QuickFindMatchField,
  QuickFindMatchMode,
  QuickFindMilestoneResultDto,
  QuickFindProjectContextDto,
  QuickFindProjectResultDto,
  QuickFindReportResultDto,
  QuickFindRequest,
  QuickFindResponseDto,
  QuickFindResultDto,
  QuickFindWorkItemContextDto,
  QuickFindWorkItemResultDto
} from './index.js';

const project = {
  id: 'project-id',
  key: 'WT',
  name: 'Worktrail',
  status: 'active'
} satisfies QuickFindProjectContextDto;

const workItem = {
  id: 'work-item-id',
  displayKey: 'WT-3',
  title: 'Implement transport-neutral API handler contract',
  status: 'in_progress',
  type: 'story'
} satisfies QuickFindWorkItemContextDto;

const projectResult = {
  kind: 'project',
  project,
  match: {
    field: 'project_name',
    mode: 'prefix',
    excerpt: null
  }
} satisfies QuickFindProjectResultDto;

const workItemResult = {
  kind: 'work_item',
  project,
  workItem,
  match: {
    field: 'work_item_key',
    mode: 'exact',
    excerpt: null
  }
} satisfies QuickFindWorkItemResultDto;

const milestoneResult = {
  kind: 'milestone',
  project,
  milestone: {
    id: 'milestone-id',
    name: 'Cloud Readiness',
    status: 'active',
    targetDate: '2026-08-15',
    isArchived: false
  },
  match: {
    field: 'milestone_description',
    mode: 'substring',
    excerpt: 'Prepare the deployment path for cloud readiness evidence.'
  }
} satisfies QuickFindMilestoneResultDto;

const cycleResult = {
  kind: 'cycle',
  project,
  cycle: {
    id: 'cycle-id',
    name: 'Release hardening',
    status: 'planned',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
    isArchived: false
  },
  match: {
    field: 'cycle_name',
    mode: 'substring',
    excerpt: null
  }
} satisfies QuickFindCycleResultDto;

const reportResult = {
  kind: 'report',
  project,
  report: {
    id: 'report-id',
    title: 'Weekly delivery status',
    statusDate: '2026-07-22',
    health: 'at_risk',
    publishedAt: '2026-07-22T15:00:00.000Z'
  },
  match: {
    field: 'report_summary',
    mode: 'substring',
    excerpt: 'Delivery remains at risk while the migration is validated.'
  }
} satisfies QuickFindReportResultDto;

const attachmentResult = {
  kind: 'attachment',
  project,
  workItem,
  attachment: {
    id: 'attachment-id',
    fileName: 'verification-evidence.json',
    byteSize: 512,
    createdAt: '2026-07-22T14:00:00.000Z'
  },
  match: {
    field: 'attachment_file_name',
    mode: 'substring',
    excerpt: null
  }
} satisfies QuickFindAttachmentResultDto;

describe('Quick Find contracts', () => {
  it('defines the strict request and complete match vocabulary', () => {
    const request = { query: 'WT-3' } satisfies QuickFindRequest;
    const modes = ['exact', 'prefix', 'substring'] satisfies QuickFindMatchMode[];
    const fields = [
      'project_key',
      'project_name',
      'project_description',
      'work_item_key',
      'work_item_title',
      'work_item_description',
      'milestone_name',
      'milestone_description',
      'cycle_name',
      'report_title',
      'report_summary',
      'attachment_file_name'
    ] satisfies QuickFindMatchField[];

    expect(request.query).toBe('WT-3');
    expect(modes).toHaveLength(3);
    expect(fields).toHaveLength(12);
  });

  it('keeps search contexts smaller than full domain and storage records', () => {
    expect('workspaceId' in project).toBe(false);
    expect('description' in project).toBe(false);
    expect('workspaceId' in workItem).toBe(false);
    expect('projectId' in workItem).toBe(false);
    expect('description' in workItem).toBe(false);
    expect('storageKey' in attachmentResult.attachment).toBe(false);
    expect('checksumSha256' in attachmentResult.attachment).toBe(false);
    expect('mediaType' in attachmentResult.attachment).toBe(false);
    expect('snapshot' in reportResult.report).toBe(false);
  });

  it('represents every result kind as one exhaustive union', () => {
    const results = [
      workItemResult,
      projectResult,
      milestoneResult,
      cycleResult,
      reportResult,
      attachmentResult
    ] satisfies QuickFindResultDto[];

    expect(results.map((result) => result.kind)).toEqual([
      'work_item',
      'project',
      'milestone',
      'cycle',
      'report',
      'attachment'
    ]);
    expectTypeOf(results).toMatchTypeOf<QuickFindResultDto[]>();
  });

  it('requires all six bounded group envelopes in every response', () => {
    const response = {
      query: 'evidence',
      groups: {
        workItems: { items: [workItemResult], hasMore: false },
        projects: { items: [projectResult], hasMore: false },
        milestones: { items: [milestoneResult], hasMore: true },
        cycles: { items: [cycleResult], hasMore: false },
        reports: { items: [reportResult], hasMore: false },
        attachments: { items: [attachmentResult], hasMore: false }
      }
    } satisfies QuickFindResponseDto;

    expect(Object.keys(response.groups)).toEqual([
      'workItems',
      'projects',
      'milestones',
      'cycles',
      'reports',
      'attachments'
    ]);
    expect(response.groups.milestones.hasMore).toBe(true);
    expectTypeOf(response).toMatchTypeOf<QuickFindResponseDto>();
  });
});
