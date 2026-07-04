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
  workItemLabels,
  workItems,
  workspaces
} from './schema.js';

const ids = {
  workspace: '10000000-0000-4000-8000-000000000001',
  members: {
    owner: '10000000-0000-4000-8000-000000000101',
    maintainer: '10000000-0000-4000-8000-000000000102',
    contributor: '10000000-0000-4000-8000-000000000103'
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
    platform: '10000000-0000-4000-8000-000000000407'
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
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: members.id,
        set: { updatedAt: now }
      });

    await tx
      .insert(projects)
      .values([
        {
          id: ids.projects.app,
          workspaceId: ids.workspace,
          key: 'WT',
          nextWorkItemNumber: 7,
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
          nextWorkItemNumber: 2,
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
          assigneeId: ids.members.contributor,
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
        { workItemId: ids.workItems.platform, labelId: ids.labels.reliability }
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
          authorId: ids.members.owner,
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
  });

  console.log('Database seed data applied.');
} finally {
  await pool.end();
}
