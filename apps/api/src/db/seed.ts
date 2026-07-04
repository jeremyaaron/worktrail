import 'dotenv/config';

import { sql } from 'drizzle-orm';

import { createDb, createPool } from './client.js';
import {
  activityEvents,
  comments,
  labels,
  members,
  milestones,
  projects,
  savedWorkViews,
  workItemLabels,
  workItems,
  workspaces,
  workspaceActivityEvents
} from './schema.js';

const ids = {
  workspace: '10000000-0000-4000-8000-000000000001',
  members: {
    owner: '10000000-0000-4000-8000-000000000101',
    maintainer: '10000000-0000-4000-8000-000000000102',
    contributor: '10000000-0000-4000-8000-000000000103',
    inactive: '10000000-0000-4000-8000-000000000104'
  },
  projects: {
    app: '10000000-0000-4000-8000-000000000201',
    platform: '10000000-0000-4000-8000-000000000202',
    archived: '10000000-0000-4000-8000-000000000203'
  },
  labels: {
    frontend: '10000000-0000-4000-8000-000000000301',
    backend: '10000000-0000-4000-8000-000000000302',
    design: '10000000-0000-4000-8000-000000000303',
    reliability: '10000000-0000-4000-8000-000000000304',
    deprecated: '10000000-0000-4000-8000-000000000305'
  },
  milestones: {
    planning: '10000000-0000-4000-8000-000000000351',
    cloud: '10000000-0000-4000-8000-000000000352',
    completed: '10000000-0000-4000-8000-000000000353'
  },
  workItems: {
    backlog: '10000000-0000-4000-8000-000000000401',
    ready: '10000000-0000-4000-8000-000000000402',
    inProgress: '10000000-0000-4000-8000-000000000403',
    blocked: '10000000-0000-4000-8000-000000000404',
    done: '10000000-0000-4000-8000-000000000405',
    canceled: '10000000-0000-4000-8000-000000000406',
    platform: '10000000-0000-4000-8000-000000000407',
    unassigned: '10000000-0000-4000-8000-000000000408',
    contributorOverdue: '10000000-0000-4000-8000-000000000409',
    platformBlocked: '10000000-0000-4000-8000-000000000410'
  },
  comments: {
    first: '10000000-0000-4000-8000-000000000501',
    second: '10000000-0000-4000-8000-000000000502'
  },
  activity: {
    created: '10000000-0000-4000-8000-000000000601',
    status: '10000000-0000-4000-8000-000000000602',
    assignee: '10000000-0000-4000-8000-000000000603',
    priority: '10000000-0000-4000-8000-000000000604',
    label: '10000000-0000-4000-8000-000000000605',
    comment: '10000000-0000-4000-8000-000000000606',
    milestone: '10000000-0000-4000-8000-000000000607'
  },
  workspaceActivity: {
    ownerCreated: '10000000-0000-4000-8000-000000000701',
    maintainerCreated: '10000000-0000-4000-8000-000000000702',
    inactiveDeactivated: '10000000-0000-4000-8000-000000000703',
    workspaceRenamed: '10000000-0000-4000-8000-000000000704',
    projectCreated: '10000000-0000-4000-8000-000000000705'
  },
  savedWorkViews: {
    ownerMyOpen: '10000000-0000-4000-8000-000000000801',
    ownerBlocked: '10000000-0000-4000-8000-000000000802',
    ownerDueSoon: '10000000-0000-4000-8000-000000000803',
    ownerUnassigned: '10000000-0000-4000-8000-000000000804',
    maintainerMyOpen: '10000000-0000-4000-8000-000000000805',
    maintainerBlocked: '10000000-0000-4000-8000-000000000806',
    maintainerDueSoon: '10000000-0000-4000-8000-000000000807',
    maintainerUnassigned: '10000000-0000-4000-8000-000000000808',
    contributorMyOpen: '10000000-0000-4000-8000-000000000809',
    contributorBlocked: '10000000-0000-4000-8000-000000000810',
    contributorDueSoon: '10000000-0000-4000-8000-000000000811',
    contributorUnassigned: '10000000-0000-4000-8000-000000000812'
  }
} as const;

const now = new Date('2026-07-03T12:00:00.000Z');
const earlier = new Date('2026-07-02T12:00:00.000Z');
const stale = new Date('2026-06-20T12:00:00.000Z');

const pool = createPool();
const db = createDb(pool);

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(workspaces)
      .values({
        id: ids.workspace,
        name: 'Worktrail Demo',
        createdAt: earlier,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: { name: 'Worktrail Demo', updatedAt: now }
      });

    await tx
      .insert(members)
      .values([
        {
          id: ids.members.owner,
          workspaceId: ids.workspace,
          name: 'Avery Owner',
          email: 'avery.owner@example.com',
          role: 'owner',
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.members.maintainer,
          workspaceId: ids.workspace,
          name: 'Morgan Maintainer',
          email: 'morgan.maintainer@example.com',
          role: 'maintainer',
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.members.contributor,
          workspaceId: ids.workspace,
          name: 'Casey Contributor',
          email: 'casey.contributor@example.com',
          role: 'contributor',
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.members.inactive,
          workspaceId: ids.workspace,
          name: 'Riley Former',
          email: 'riley.former@example.com',
          role: 'contributor',
          isActive: false,
          deactivatedAt: stale,
          deactivatedById: ids.members.owner,
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: members.id,
        set: {
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          role: sql`excluded.role`,
          isActive: sql`excluded.is_active`,
          deactivatedAt: sql`excluded.deactivated_at`,
          deactivatedById: sql`excluded.deactivated_by_id`,
          updatedAt: now
        }
      });

    await tx
      .insert(projects)
      .values([
        {
          id: ids.projects.app,
          workspaceId: ids.workspace,
          key: 'WT',
          nextWorkItemNumber: 9,
          name: 'Worktrail App',
          description: 'MVP project management reference application.',
          status: 'active',
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.projects.platform,
          workspaceId: ids.workspace,
          key: 'CLOUD',
          nextWorkItemNumber: 4,
          name: 'Cloud Readiness',
          description: 'Future deployment and production architecture exploration.',
          status: 'active',
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.projects.archived,
          workspaceId: ids.workspace,
          key: 'LEGACY',
          nextWorkItemNumber: 1,
          name: 'Legacy Tracker',
          description: 'Archived project used to verify archived states.',
          status: 'archived',
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          key: sql`excluded.key`,
          nextWorkItemNumber: sql`excluded.next_work_item_number`,
          updatedAt: now
        }
      });

    await tx
      .insert(labels)
      .values([
        {
          id: ids.labels.frontend,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'frontend',
          color: '#2563eb',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.labels.backend,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'backend',
          color: '#059669',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.labels.design,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'design',
          color: '#7c3aed',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.labels.reliability,
          workspaceId: ids.workspace,
          projectId: ids.projects.platform,
          name: 'reliability',
          color: '#dc2626',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.labels.deprecated,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'deprecated',
          color: '#64748b',
          archivedAt: now,
          archivedById: ids.members.owner,
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: labels.id,
        set: {
          color: sql`excluded.color`,
          archivedAt: sql`excluded.archived_at`,
          archivedById: sql`excluded.archived_by_id`,
          updatedAt: now
        }
      });

    await tx
      .insert(milestones)
      .values([
        {
          id: ids.milestones.planning,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.0.3 Planning',
          description: 'Planning target for milestones, board ordering, discovery, and dashboard work.',
          status: 'active',
          targetDate: '2026-07-18',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.milestones.cloud,
          workspaceId: ids.workspace,
          projectId: ids.projects.platform,
          name: 'Cloud Readiness',
          description: 'Future deployment path and production architecture planning.',
          status: 'planned',
          targetDate: '2026-08-15',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.milestones.completed,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.0.1 MVP',
          description: 'Completed baseline local project management workflow.',
          status: 'completed',
          targetDate: '2026-07-03',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: milestones.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          status: sql`excluded.status`,
          targetDate: sql`excluded.target_date`,
          archivedAt: sql`excluded.archived_at`,
          archivedById: sql`excluded.archived_by_id`,
          updatedAt: now
        }
      });

    await tx
      .insert(workItems)
      .values([
        {
          id: ids.workItems.backlog,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 1,
          displayKey: 'WT-1',
          title: 'Define project home summary cards',
          description: 'Show counts by status and recently updated work.',
          type: 'story',
          status: 'backlog',
          priority: 'medium',
          assigneeId: ids.members.contributor,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.planning,
          boardPosition: 1024,
          dueDate: '2026-07-07',
          estimatePoints: 3,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.ready,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 2,
          displayKey: 'WT-2',
          title: 'Add filter controls to work item list',
          description: 'Filter by status, assignee, type, label, and priority.',
          type: 'task',
          status: 'ready',
          priority: 'high',
          assigneeId: ids.members.maintainer,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.planning,
          boardPosition: 1024,
          dueDate: '2026-07-10',
          estimatePoints: 5,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.inProgress,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 3,
          displayKey: 'WT-3',
          title: 'Implement transport-neutral API handler contract',
          description: 'Keep Express concerns out of application services.',
          type: 'task',
          status: 'in_progress',
          priority: 'urgent',
          assigneeId: ids.members.maintainer,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.planning,
          boardPosition: 1024,
          dueDate: '2026-07-08',
          estimatePoints: 8,
          createdAt: earlier,
          updatedAt: stale
        },
        {
          id: ids.workItems.blocked,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 4,
          displayKey: 'WT-4',
          title: 'Choose status transition copy',
          description: 'Blocked until the first board interaction is implemented.',
          type: 'chore',
          status: 'blocked',
          priority: 'low',
          assigneeId: ids.members.inactive,
          reporterId: ids.members.maintainer,
          milestoneId: ids.milestones.planning,
          boardPosition: 1024,
          dueDate: '2026-06-30',
          estimatePoints: 2,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.done,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 5,
          displayKey: 'WT-5',
          title: 'Create initial MVP planning docs',
          description: 'PRD, technical design, and implementation plan.',
          type: 'chore',
          status: 'done',
          priority: 'medium',
          assigneeId: ids.members.owner,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.completed,
          boardPosition: 1024,
          dueDate: null,
          estimatePoints: 2,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.canceled,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 6,
          displayKey: 'WT-6',
          title: 'Prototype drag-and-drop before status menus',
          description: 'Deferred because status menus satisfy the MVP.',
          type: 'chore',
          status: 'canceled',
          priority: 'low',
          assigneeId: null,
          reporterId: ids.members.maintainer,
          milestoneId: null,
          boardPosition: 1024,
          dueDate: null,
          estimatePoints: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.platform,
          workspaceId: ids.workspace,
          projectId: ids.projects.platform,
          itemNumber: 1,
          displayKey: 'CLOUD-1',
          title: 'Document future S3 and API Gateway deployment path',
          description: 'Keep the first build local while preserving cloud-ready boundaries.',
          type: 'story',
          status: 'ready',
          priority: 'high',
          assigneeId: ids.members.owner,
          reporterId: ids.members.maintainer,
          milestoneId: ids.milestones.cloud,
          boardPosition: 1024,
          dueDate: '2026-07-17',
          estimatePoints: 5,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.unassigned,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 7,
          displayKey: 'WT-7',
          title: 'Triage unassigned onboarding feedback',
          description: 'Keep an active unassigned item available for workspace discovery demos.',
          type: 'task',
          status: 'ready',
          priority: 'medium',
          assigneeId: null,
          reporterId: ids.members.contributor,
          milestoneId: ids.milestones.planning,
          boardPosition: 2048,
          dueDate: '2026-07-11',
          estimatePoints: 3,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.contributorOverdue,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 8,
          displayKey: 'WT-8',
          title: 'Review contributor dashboard empty states',
          description: 'Exercise overdue assigned work on the My Work dashboard.',
          type: 'story',
          status: 'in_progress',
          priority: 'high',
          assigneeId: ids.members.contributor,
          reporterId: ids.members.maintainer,
          milestoneId: ids.milestones.planning,
          boardPosition: 2048,
          dueDate: '2026-07-01',
          estimatePoints: 5,
          createdAt: earlier,
          updatedAt: stale
        },
        {
          id: ids.workItems.platformBlocked,
          workspaceId: ids.workspace,
          projectId: ids.projects.platform,
          itemNumber: 2,
          displayKey: 'CLOUD-2',
          title: 'Decide serverless database connection strategy',
          description: 'Blocked until the deployment reference architecture is narrowed.',
          type: 'story',
          status: 'blocked',
          priority: 'urgent',
          assigneeId: ids.members.owner,
          reporterId: ids.members.contributor,
          milestoneId: ids.milestones.cloud,
          boardPosition: 1024,
          dueDate: '2026-07-09',
          estimatePoints: 8,
          createdAt: earlier,
          updatedAt: stale
        }
      ])
      .onConflictDoUpdate({
        target: workItems.id,
        set: {
          itemNumber: sql`excluded.item_number`,
          displayKey: sql`excluded.display_key`,
          milestoneId: sql`excluded.milestone_id`,
          boardPosition: sql`excluded.board_position`,
          dueDate: sql`excluded.due_date`,
          estimatePoints: sql`excluded.estimate_points`,
          updatedAt: sql`excluded.updated_at`
        }
      });

    await tx
      .insert(workItemLabels)
      .values([
        { workItemId: ids.workItems.backlog, labelId: ids.labels.design },
        { workItemId: ids.workItems.ready, labelId: ids.labels.frontend },
        { workItemId: ids.workItems.ready, labelId: ids.labels.backend },
        { workItemId: ids.workItems.inProgress, labelId: ids.labels.backend },
        { workItemId: ids.workItems.platform, labelId: ids.labels.reliability },
        { workItemId: ids.workItems.unassigned, labelId: ids.labels.design },
        { workItemId: ids.workItems.contributorOverdue, labelId: ids.labels.frontend },
        { workItemId: ids.workItems.platformBlocked, labelId: ids.labels.reliability }
      ])
      .onConflictDoNothing();

    await tx
      .insert(comments)
      .values([
        {
          id: ids.comments.first,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          authorId: ids.members.inactive,
          body: 'This is the first slice that should prove the local API shape.',
          editedAt: null,
          deletedAt: null,
          deletedById: null,
          createdAt: earlier,
          updatedAt: earlier
        },
        {
          id: ids.comments.second,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          authorId: ids.members.maintainer,
          body: 'Keep the handler contract small enough to adapt to Lambda later.',
          editedAt: null,
          deletedAt: null,
          deletedById: null,
          createdAt: now,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: comments.id,
        set: {
          editedAt: sql`excluded.edited_at`,
          deletedAt: sql`excluded.deleted_at`,
          deletedById: sql`excluded.deleted_by_id`,
          updatedAt: now
        }
      });

    await tx
      .insert(activityEvents)
      .values([
        {
          id: ids.activity.created,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.owner,
          eventType: 'work_item.created',
          summary: 'Avery Owner created this work item.',
          previousValue: null,
          newValue: { status: 'backlog' },
          metadata: {},
          createdAt: earlier
        },
        {
          id: ids.activity.status,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.maintainer,
          eventType: 'work_item.status_changed',
          summary: 'Morgan Maintainer moved this work item from ready to in progress.',
          previousValue: { status: 'ready' },
          newValue: { status: 'in_progress' },
          metadata: {},
          createdAt: now
        },
        {
          id: ids.activity.assignee,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.owner,
          eventType: 'work_item.assignee_changed',
          summary: 'Avery Owner assigned this work item to Morgan Maintainer.',
          previousValue: { assigneeId: null },
          newValue: { assigneeId: ids.members.maintainer },
          metadata: {},
          createdAt: now
        },
        {
          id: ids.activity.priority,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.owner,
          eventType: 'work_item.priority_changed',
          summary: 'Avery Owner changed priority from high to urgent.',
          previousValue: { priority: 'high' },
          newValue: { priority: 'urgent' },
          metadata: {},
          createdAt: now
        },
        {
          id: ids.activity.label,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.maintainer,
          eventType: 'work_item.label_added',
          summary: 'Morgan Maintainer added the backend label.',
          previousValue: null,
          newValue: { labelId: ids.labels.backend, labelName: 'backend' },
          metadata: {},
          createdAt: now
        },
        {
          id: ids.activity.comment,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.maintainer,
          eventType: 'comment.added',
          summary: 'Morgan Maintainer added a comment.',
          previousValue: null,
          newValue: null,
          metadata: { commentId: ids.comments.second },
          createdAt: now
        },
        {
          id: ids.activity.milestone,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          actorId: ids.members.maintainer,
          eventType: 'work_item.milestone_changed',
          summary: 'Morgan Maintainer assigned this work item to v0.0.3 Planning.',
          previousValue: { milestoneId: null },
          newValue: { milestoneId: ids.milestones.planning, milestoneName: 'v0.0.3 Planning' },
          metadata: {},
          createdAt: now
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(workspaceActivityEvents)
      .values([
        {
          id: ids.workspaceActivity.ownerCreated,
          workspaceId: ids.workspace,
          actorId: ids.members.owner,
          eventType: 'member.created',
          summary: 'Avery Owner added Morgan Maintainer to the workspace.',
          previousValue: null,
          newValue: {
            memberId: ids.members.maintainer,
            role: 'maintainer'
          },
          metadata: { memberId: ids.members.maintainer },
          createdAt: earlier
        },
        {
          id: ids.workspaceActivity.maintainerCreated,
          workspaceId: ids.workspace,
          actorId: ids.members.owner,
          eventType: 'member.created',
          summary: 'Avery Owner added Casey Contributor to the workspace.',
          previousValue: null,
          newValue: {
            memberId: ids.members.contributor,
            role: 'contributor'
          },
          metadata: { memberId: ids.members.contributor },
          createdAt: earlier
        },
        {
          id: ids.workspaceActivity.inactiveDeactivated,
          workspaceId: ids.workspace,
          actorId: ids.members.owner,
          eventType: 'member.deactivated',
          summary: 'Avery Owner deactivated Riley Former.',
          previousValue: { isActive: true },
          newValue: { isActive: false },
          metadata: { memberId: ids.members.inactive },
          createdAt: stale
        },
        {
          id: ids.workspaceActivity.workspaceRenamed,
          workspaceId: ids.workspace,
          actorId: ids.members.owner,
          eventType: 'workspace.name_changed',
          summary: 'Avery Owner renamed the workspace to Worktrail Demo.',
          previousValue: { name: 'PM Reference Demo' },
          newValue: { name: 'Worktrail Demo' },
          metadata: {},
          createdAt: earlier
        },
        {
          id: ids.workspaceActivity.projectCreated,
          workspaceId: ids.workspace,
          actorId: ids.members.owner,
          eventType: 'project.created',
          summary: 'Avery Owner created the Worktrail App project.',
          previousValue: null,
          newValue: {
            projectId: ids.projects.app,
            projectKey: 'WT'
          },
          metadata: {
            projectId: ids.projects.app,
            projectKey: 'WT'
          },
          createdAt: earlier
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(savedWorkViews)
      .values([
        {
          id: ids.savedWorkViews.ownerMyOpen,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          name: 'My open work',
          visibility: 'personal',
          query: { assigneeId: ids.members.owner, archivedProjects: 'exclude', sort: 'updated_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.ownerBlocked,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          name: 'Blocked work',
          visibility: 'personal',
          query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.ownerDueSoon,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          name: 'Due soon',
          visibility: 'personal',
          query: { dueDateState: 'due_soon', archivedProjects: 'exclude', sort: 'due_date_asc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.ownerUnassigned,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          name: 'Unassigned work',
          visibility: 'personal',
          query: { assigneeState: 'unassigned', archivedProjects: 'exclude', sort: 'updated_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.maintainerMyOpen,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.maintainer,
          name: 'My open work',
          visibility: 'personal',
          query: {
            assigneeId: ids.members.maintainer,
            archivedProjects: 'exclude',
            sort: 'updated_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.maintainerBlocked,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.maintainer,
          name: 'Blocked work',
          visibility: 'personal',
          query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.maintainerDueSoon,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.maintainer,
          name: 'Due soon',
          visibility: 'personal',
          query: { dueDateState: 'due_soon', archivedProjects: 'exclude', sort: 'due_date_asc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.maintainerUnassigned,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.maintainer,
          name: 'Unassigned work',
          visibility: 'personal',
          query: { assigneeState: 'unassigned', archivedProjects: 'exclude', sort: 'updated_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.contributorMyOpen,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.contributor,
          name: 'My open work',
          visibility: 'personal',
          query: {
            assigneeId: ids.members.contributor,
            archivedProjects: 'exclude',
            sort: 'updated_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.contributorBlocked,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.contributor,
          name: 'Blocked work',
          visibility: 'personal',
          query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.contributorDueSoon,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.contributor,
          name: 'Due soon',
          visibility: 'personal',
          query: { dueDateState: 'due_soon', archivedProjects: 'exclude', sort: 'due_date_asc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.contributorUnassigned,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.contributor,
          name: 'Unassigned work',
          visibility: 'personal',
          query: { assigneeState: 'unassigned', archivedProjects: 'exclude', sort: 'updated_desc' },
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: savedWorkViews.id,
        set: {
          name: sql`excluded.name`,
          visibility: sql`excluded.visibility`,
          query: sql`excluded.query`,
          updatedAt: now
        }
      });
  });

  console.log('Database seed data applied.');
} finally {
  await pool.end();
}
