import type {
  DeliveryHealthState,
  MilestoneStatus,
  ProjectCycleStatus,
  ProjectStatus,
  QuickFindMatchDto,
  WorkItemStatus,
  WorkItemType
} from '@worktrail/contracts';
import { and, asc, eq, isNotNull, or, sql } from 'drizzle-orm';

import type { WorktrailDb } from '../db/client.js';
import {
  milestones,
  projectCycles,
  projects,
  projectStatusReports,
  workItemAttachments,
  workItems
} from '../db/schema.js';
import {
  buildQuickFindMatchSql,
  createQuickFindSearchTerms,
  quickFindLifecycleRankSql
} from './quick-find-sql.js';

const maximumQuickFindGroupLimit = 25;
const deliveryHealthStates = new Set<DeliveryHealthState>([
  'healthy',
  'at_risk',
  'blocked',
  'complete',
  'inactive'
]);

export interface QuickFindRepositoryInput {
  workspaceId: string;
  query: string;
  groupLimit: number;
}

export interface QuickFindRepositoryGroup<TItem> {
  items: TItem[];
  hasMore: boolean;
}

export interface QuickFindProjectContextRecord {
  id: string;
  key: string;
  name: string;
  status: ProjectStatus;
}

export interface QuickFindWorkItemContextRecord {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  type: WorkItemType;
}

export interface QuickFindProjectRecord {
  kind: 'project';
  project: QuickFindProjectContextRecord;
  match: QuickFindMatchDto;
}

export interface QuickFindWorkItemRecord {
  kind: 'work_item';
  project: QuickFindProjectContextRecord;
  workItem: QuickFindWorkItemContextRecord;
  match: QuickFindMatchDto;
}

export interface QuickFindMilestoneRecord {
  kind: 'milestone';
  project: QuickFindProjectContextRecord;
  milestone: {
    id: string;
    name: string;
    status: MilestoneStatus;
    targetDate: string | null;
    isArchived: boolean;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindCycleRecord {
  kind: 'cycle';
  project: QuickFindProjectContextRecord;
  cycle: {
    id: string;
    name: string;
    status: ProjectCycleStatus;
    startDate: string;
    endDate: string;
    isArchived: boolean;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindReportRecord {
  kind: 'report';
  project: QuickFindProjectContextRecord;
  report: {
    id: string;
    title: string;
    statusDate: string;
    health: DeliveryHealthState;
    publishedAt: Date;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindAttachmentRecord {
  kind: 'attachment';
  project: QuickFindProjectContextRecord;
  workItem: QuickFindWorkItemContextRecord;
  attachment: {
    id: string;
    fileName: string;
    byteSize: number;
    createdAt: Date;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindRepositoryResult {
  workItems: QuickFindRepositoryGroup<QuickFindWorkItemRecord>;
  projects: QuickFindRepositoryGroup<QuickFindProjectRecord>;
  milestones: QuickFindRepositoryGroup<QuickFindMilestoneRecord>;
  cycles: QuickFindRepositoryGroup<QuickFindCycleRecord>;
  reports: QuickFindRepositoryGroup<QuickFindReportRecord>;
  attachments: QuickFindRepositoryGroup<QuickFindAttachmentRecord>;
}

export function createQuickFindRepository(db: WorktrailDb) {
  return {
    async searchWorkspace(input: QuickFindRepositoryInput): Promise<QuickFindRepositoryResult> {
      assertGroupLimit(input.groupLimit);
      const terms = createQuickFindSearchTerms(input.query);
      const rowLimit = input.groupLimit + 1;

      const workItemRows = await searchWorkItems(db, input.workspaceId, terms, rowLimit);
      const projectRows = await searchProjects(db, input.workspaceId, terms, rowLimit);
      const milestoneRows = await searchMilestones(db, input.workspaceId, terms, rowLimit);
      const cycleRows = await searchCycles(db, input.workspaceId, terms, rowLimit);
      const reportRows = await searchReports(db, input.workspaceId, terms, rowLimit);
      const attachmentRows = await searchAttachments(db, input.workspaceId, terms, rowLimit);

      return {
        workItems: boundedGroup(workItemRows, input.groupLimit, mapWorkItemRecord),
        projects: boundedGroup(projectRows, input.groupLimit, mapProjectRecord),
        milestones: boundedGroup(milestoneRows, input.groupLimit, mapMilestoneRecord),
        cycles: boundedGroup(cycleRows, input.groupLimit, mapCycleRecord),
        reports: boundedGroup(reportRows, input.groupLimit, mapReportRecord),
        attachments: boundedGroup(attachmentRows, input.groupLimit, mapAttachmentRecord)
      };
    }
  };
}

type QuickFindTerms = ReturnType<typeof createQuickFindSearchTerms>;

function searchProjects(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    key: { column: projects.key, matchField: 'project_key' },
    primary: { column: projects.name, matchField: 'project_name' },
    narrative: { column: projects.description, matchField: 'project_description' }
  });
  const lifecycleRank = quickFindLifecycleRankSql(eq(projects.status, 'archived'));

  return db
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      status: projects.status,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), match.condition))
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${projects.name})`),
      asc(sql`lower(${projects.key})`),
      asc(projects.id)
    )
    .limit(rowLimit);
}

function searchWorkItems(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    key: { column: workItems.displayKey, matchField: 'work_item_key' },
    primary: { column: workItems.title, matchField: 'work_item_title' },
    narrative: { column: workItems.description, matchField: 'work_item_description' }
  });
  const lifecycleRank = quickFindLifecycleRankSql(eq(projects.status, 'archived'));

  return db
    .select({
      id: workItems.id,
      displayKey: workItems.displayKey,
      title: workItems.title,
      status: workItems.status,
      type: workItems.type,
      projectId: projects.id,
      projectKey: projects.key,
      projectName: projects.name,
      projectStatus: projects.status,
      itemNumber: workItems.itemNumber,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(workItems)
    .innerJoin(
      projects,
      and(
        eq(projects.id, workItems.projectId),
        eq(projects.workspaceId, workItems.workspaceId)
      )
    )
    .where(
      and(
        eq(workItems.workspaceId, workspaceId),
        eq(projects.workspaceId, workspaceId),
        match.condition
      )
    )
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${workItems.title})`),
      asc(sql`lower(${projects.key})`),
      asc(workItems.itemNumber),
      asc(workItems.id)
    )
    .limit(rowLimit);
}

function searchMilestones(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    primary: { column: milestones.name, matchField: 'milestone_name' },
    narrative: { column: milestones.description, matchField: 'milestone_description' }
  });
  const lifecycleRank = quickFindLifecycleRankSql(
    or(isNotNull(milestones.archivedAt), eq(projects.status, 'archived'))!
  );

  return db
    .select({
      id: milestones.id,
      name: milestones.name,
      status: milestones.status,
      targetDate: milestones.targetDate,
      archivedAt: milestones.archivedAt,
      projectId: projects.id,
      projectKey: projects.key,
      projectName: projects.name,
      projectStatus: projects.status,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(milestones)
    .innerJoin(
      projects,
      and(
        eq(projects.id, milestones.projectId),
        eq(projects.workspaceId, milestones.workspaceId)
      )
    )
    .where(
      and(
        eq(milestones.workspaceId, workspaceId),
        eq(projects.workspaceId, workspaceId),
        match.condition
      )
    )
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${milestones.name})`),
      asc(sql`lower(${projects.key})`),
      asc(milestones.id)
    )
    .limit(rowLimit);
}

function searchCycles(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    primary: { column: projectCycles.name, matchField: 'cycle_name' }
  });
  const lifecycleRank = quickFindLifecycleRankSql(
    or(isNotNull(projectCycles.archivedAt), eq(projects.status, 'archived'))!
  );

  return db
    .select({
      id: projectCycles.id,
      name: projectCycles.name,
      status: projectCycles.status,
      startDate: projectCycles.startDate,
      endDate: projectCycles.endDate,
      archivedAt: projectCycles.archivedAt,
      projectId: projects.id,
      projectKey: projects.key,
      projectName: projects.name,
      projectStatus: projects.status,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(projectCycles)
    .innerJoin(
      projects,
      and(
        eq(projects.id, projectCycles.projectId),
        eq(projects.workspaceId, projectCycles.workspaceId)
      )
    )
    .where(
      and(
        eq(projectCycles.workspaceId, workspaceId),
        eq(projects.workspaceId, workspaceId),
        match.condition
      )
    )
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${projectCycles.name})`),
      asc(sql`lower(${projects.key})`),
      asc(projectCycles.id)
    )
    .limit(rowLimit);
}

function searchReports(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    primary: { column: projectStatusReports.title, matchField: 'report_title' },
    narrative: { column: projectStatusReports.summary, matchField: 'report_summary' }
  });
  const lifecycleRank = quickFindLifecycleRankSql(eq(projects.status, 'archived'));
  const health = sql<string | null>`case
    when ${projectStatusReports.snapshot} -> 'health' ->> 'health'
      in ('healthy', 'at_risk', 'blocked', 'complete', 'inactive')
      then ${projectStatusReports.snapshot} -> 'health' ->> 'health'
    else null
  end`;

  return db
    .select({
      id: projectStatusReports.id,
      title: projectStatusReports.title,
      statusDate: projectStatusReports.statusDate,
      publishedAt: projectStatusReports.publishedAt,
      health,
      projectId: projects.id,
      projectKey: projects.key,
      projectName: projects.name,
      projectStatus: projects.status,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(projectStatusReports)
    .innerJoin(
      projects,
      and(
        eq(projects.id, projectStatusReports.projectId),
        eq(projects.workspaceId, projectStatusReports.workspaceId)
      )
    )
    .where(
      and(
        eq(projectStatusReports.workspaceId, workspaceId),
        eq(projects.workspaceId, workspaceId),
        match.condition
      )
    )
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${projectStatusReports.title})`),
      asc(sql`lower(${projects.key})`),
      asc(projectStatusReports.id)
    )
    .limit(rowLimit);
}

function searchAttachments(
  db: WorktrailDb,
  workspaceId: string,
  terms: QuickFindTerms,
  rowLimit: number
) {
  const match = buildQuickFindMatchSql({
    terms,
    primary: {
      column: workItemAttachments.fileName,
      matchField: 'attachment_file_name'
    }
  });
  const lifecycleRank = quickFindLifecycleRankSql(eq(projects.status, 'archived'));

  return db
    .select({
      id: workItemAttachments.id,
      fileName: workItemAttachments.fileName,
      byteSize: workItemAttachments.byteSize,
      createdAt: workItemAttachments.createdAt,
      workItemId: workItems.id,
      displayKey: workItems.displayKey,
      workItemTitle: workItems.title,
      workItemStatus: workItems.status,
      workItemType: workItems.type,
      itemNumber: workItems.itemNumber,
      projectId: projects.id,
      projectKey: projects.key,
      projectName: projects.name,
      projectStatus: projects.status,
      matchField: match.matchField,
      matchMode: match.matchMode,
      excerpt: match.excerpt
    })
    .from(workItemAttachments)
    .innerJoin(
      workItems,
      and(
        eq(workItems.id, workItemAttachments.workItemId),
        eq(workItems.projectId, workItemAttachments.projectId),
        eq(workItems.workspaceId, workItemAttachments.workspaceId)
      )
    )
    .innerJoin(
      projects,
      and(
        eq(projects.id, workItems.projectId),
        eq(projects.workspaceId, workItems.workspaceId)
      )
    )
    .where(
      and(
        eq(workItemAttachments.workspaceId, workspaceId),
        eq(workItems.workspaceId, workspaceId),
        eq(projects.workspaceId, workspaceId),
        match.condition
      )
    )
    .orderBy(
      asc(match.relevanceRank),
      asc(lifecycleRank),
      asc(sql`lower(${workItemAttachments.fileName})`),
      asc(sql`lower(${projects.key})`),
      asc(workItems.itemNumber),
      asc(workItemAttachments.id)
    )
    .limit(rowLimit);
}

function boundedGroup<TRow, TItem>(
  rows: TRow[],
  groupLimit: number,
  mapRow: (row: TRow) => TItem
): QuickFindRepositoryGroup<TItem> {
  return {
    items: rows.slice(0, groupLimit).map(mapRow),
    hasMore: rows.length > groupLimit
  };
}

function mapProjectRecord(row: Awaited<ReturnType<typeof searchProjects>>[number]): QuickFindProjectRecord {
  return {
    kind: 'project',
    project: {
      id: row.id,
      key: row.key,
      name: row.name,
      status: row.status
    },
    match: matchContext(row)
  };
}

function mapWorkItemRecord(
  row: Awaited<ReturnType<typeof searchWorkItems>>[number]
): QuickFindWorkItemRecord {
  return {
    kind: 'work_item',
    project: joinedProjectContext(row),
    workItem: {
      id: row.id,
      displayKey: row.displayKey,
      title: row.title,
      status: row.status,
      type: row.type
    },
    match: matchContext(row)
  };
}

function mapMilestoneRecord(
  row: Awaited<ReturnType<typeof searchMilestones>>[number]
): QuickFindMilestoneRecord {
  return {
    kind: 'milestone',
    project: joinedProjectContext(row),
    milestone: {
      id: row.id,
      name: row.name,
      status: row.status,
      targetDate: row.targetDate,
      isArchived: row.archivedAt !== null || row.projectStatus === 'archived'
    },
    match: matchContext(row)
  };
}

function mapCycleRecord(
  row: Awaited<ReturnType<typeof searchCycles>>[number]
): QuickFindCycleRecord {
  return {
    kind: 'cycle',
    project: joinedProjectContext(row),
    cycle: {
      id: row.id,
      name: row.name,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      isArchived: row.archivedAt !== null || row.projectStatus === 'archived'
    },
    match: matchContext(row)
  };
}

function mapReportRecord(
  row: Awaited<ReturnType<typeof searchReports>>[number]
): QuickFindReportRecord {
  if (row.health === null || !deliveryHealthStates.has(row.health as DeliveryHealthState)) {
    throw new Error('Stored project status report health is invalid.');
  }

  return {
    kind: 'report',
    project: joinedProjectContext(row),
    report: {
      id: row.id,
      title: row.title,
      statusDate: row.statusDate,
      health: row.health as DeliveryHealthState,
      publishedAt: row.publishedAt
    },
    match: matchContext(row)
  };
}

function mapAttachmentRecord(
  row: Awaited<ReturnType<typeof searchAttachments>>[number]
): QuickFindAttachmentRecord {
  return {
    kind: 'attachment',
    project: joinedProjectContext(row),
    workItem: {
      id: row.workItemId,
      displayKey: row.displayKey,
      title: row.workItemTitle,
      status: row.workItemStatus,
      type: row.workItemType
    },
    attachment: {
      id: row.id,
      fileName: row.fileName,
      byteSize: row.byteSize,
      createdAt: row.createdAt
    },
    match: matchContext(row)
  };
}

function joinedProjectContext(row: {
  projectId: string;
  projectKey: string;
  projectName: string;
  projectStatus: ProjectStatus;
}): QuickFindProjectContextRecord {
  return {
    id: row.projectId,
    key: row.projectKey,
    name: row.projectName,
    status: row.projectStatus
  };
}

function matchContext(row: {
  matchField: QuickFindMatchDto['field'] | null;
  matchMode: QuickFindMatchDto['mode'] | null;
  excerpt: string | null;
}): QuickFindMatchDto {
  if (row.matchField === null || row.matchMode === null) {
    throw new Error('Quick Find match metadata is incomplete.');
  }

  return {
    field: row.matchField,
    mode: row.matchMode,
    excerpt: row.excerpt
  };
}

function assertGroupLimit(groupLimit: number): void {
  if (
    !Number.isSafeInteger(groupLimit) ||
    groupLimit < 1 ||
    groupLimit > maximumQuickFindGroupLimit
  ) {
    throw new RangeError(
      `Quick Find group limit must be an integer between 1 and ${maximumQuickFindGroupLimit}.`
    );
  }
}
