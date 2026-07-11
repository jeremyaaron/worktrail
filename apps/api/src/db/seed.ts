import 'dotenv/config';

import { eq, sql } from 'drizzle-orm';

import { createDb, createPool } from './client.js';
import {
  activityEvents,
  commentMentions,
  comments,
  labels,
  members,
  milestones,
  notifications,
  projects,
  projectCycles,
  projectStatusReports,
  savedWorkViews,
  workItemLabels,
  workItemRelationships,
  workItemWatchers,
  workItems,
  workspaces,
  workspaceActivityEvents
} from './schema.js';
import { localSeedActor } from '../domain/actor.js';
import { createRepositories } from '../repositories/index.js';
import { ProjectStatusReportService } from '../services/project-status-report-service.js';

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
    archived: '10000000-0000-4000-8000-000000000203',
    operations: '10000000-0000-4000-8000-000000000204'
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
    completed: '10000000-0000-4000-8000-000000000353',
    health: '10000000-0000-4000-8000-000000000354',
    atRisk: '10000000-0000-4000-8000-000000000355',
    inactive: '10000000-0000-4000-8000-000000000356',
    operations: '10000000-0000-4000-8000-000000000357'
  },
  cycles: {
    active: '10000000-0000-4000-8000-000000000371',
    upcoming: '10000000-0000-4000-8000-000000000372',
    completed: '10000000-0000-4000-8000-000000000373'
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
    platformBlocked: '10000000-0000-4000-8000-000000000410',
    healthyMilestone: '10000000-0000-4000-8000-000000000411',
    atRiskMilestone: '10000000-0000-4000-8000-000000000412',
    unmilestonedRisk: '10000000-0000-4000-8000-000000000413',
    operationsReady: '10000000-0000-4000-8000-000000000414'
  },
  workItemRelationships: {
    sameProjectBlock: '10000000-0000-4000-8000-000000000451',
    crossProjectBlock: '10000000-0000-4000-8000-000000000452',
    relatedWork: '10000000-0000-4000-8000-000000000453',
    terminalBlocker: '10000000-0000-4000-8000-000000000454'
  },
  comments: {
    first: '10000000-0000-4000-8000-000000000501',
    second: '10000000-0000-4000-8000-000000000502'
  },
  workItemWatchers: {
    inProgressOwner: '10000000-0000-4000-8000-000000000551',
    inProgressMaintainer: '10000000-0000-4000-8000-000000000552',
    inProgressContributor: '10000000-0000-4000-8000-000000000553',
    readyOwner: '10000000-0000-4000-8000-000000000554',
    platformBlockedOwner: '10000000-0000-4000-8000-000000000555',
    platformBlockedContributor: '10000000-0000-4000-8000-000000000556'
  },
  activity: {
    created: '10000000-0000-4000-8000-000000000601',
    status: '10000000-0000-4000-8000-000000000602',
    assignee: '10000000-0000-4000-8000-000000000603',
    priority: '10000000-0000-4000-8000-000000000604',
    label: '10000000-0000-4000-8000-000000000605',
    comment: '10000000-0000-4000-8000-000000000606',
    milestone: '10000000-0000-4000-8000-000000000607',
    statusReport: '10000000-0000-4000-8000-000000000608',
    operationsStatusReport: '10000000-0000-4000-8000-000000000609'
  },
  statusReports: {
    appWeekly: '10000000-0000-4000-8000-000000000651',
    operationsWeekly: '10000000-0000-4000-8000-000000000652'
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
    contributorUnassigned: '10000000-0000-4000-8000-000000000812',
    workspaceBlocked: '10000000-0000-4000-8000-000000000813',
    workspaceDependencyRisks: '10000000-0000-4000-8000-000000000814',
    workspaceDueSoon: '10000000-0000-4000-8000-000000000815',
    workspaceUnassignedOpen: '10000000-0000-4000-8000-000000000816',
    workspaceReadyForPickup: '10000000-0000-4000-8000-000000000817',
    appReleaseBlockers: '10000000-0000-4000-8000-000000000818',
    appReadyForQa: '10000000-0000-4000-8000-000000000819',
    appUnassignedProjectWork: '10000000-0000-4000-8000-000000000820',
    appCurrentMilestoneRisk: '10000000-0000-4000-8000-000000000821',
    appOpenDependencyRisks: '10000000-0000-4000-8000-000000000822',
    ownerAppOpenWork: '10000000-0000-4000-8000-000000000823',
    platformReleaseBlockers: '10000000-0000-4000-8000-000000000824',
    platformReadyForQa: '10000000-0000-4000-8000-000000000825',
    appCurrentCycleRisk: '10000000-0000-4000-8000-000000000826'
  },
  notifications: {
    ownerWatchedStatus: '10000000-0000-4000-8000-000000000901',
    ownerDependency: '10000000-0000-4000-8000-000000000902',
    contributorMention: '10000000-0000-4000-8000-000000000903',
    maintainerReadAssignment: '10000000-0000-4000-8000-000000000904'
  }
} as const;

const now = new Date('2026-07-03T12:00:00.000Z');
const earlier = new Date('2026-07-02T12:00:00.000Z');
const stale = new Date('2026-06-20T12:00:00.000Z');
const workspaceSavedViewDefaults = {
  projectId: null,
  scope: 'workspace',
  isPinned: false
} as const;

const pool = createPool();
const db = createDb(pool);

try {
  await db.transaction(async (tx) => {
    await tx.delete(projectStatusReports).where(eq(projectStatusReports.id, ids.statusReports.appWeekly));
    await tx.delete(projectStatusReports).where(eq(projectStatusReports.id, ids.statusReports.operationsWeekly));
    await tx.delete(activityEvents).where(eq(activityEvents.id, ids.activity.statusReport));
    await tx.delete(activityEvents).where(eq(activityEvents.id, ids.activity.operationsStatusReport));

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
          nextWorkItemNumber: 12,
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
          id: ids.projects.operations,
          workspaceId: ids.workspace,
          key: 'OPS',
          nextWorkItemNumber: 2,
          name: 'Reference Operations',
          description: 'Steady-state project used to contrast healthier portfolio delivery.',
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
        },
        {
          id: ids.milestones.health,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.0.9 Health Model',
          description: 'On-track target for delivery health display and reason-link demos.',
          status: 'active',
          targetDate: '2026-07-24',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.milestones.atRisk,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'Planning Review Polish',
          description: 'At-risk target with upcoming work for delivery review examples.',
          status: 'planned',
          targetDate: '2026-07-09',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.milestones.inactive,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'Deprecated Timeline Prototype',
          description: 'Canceled milestone kept to demonstrate inactive delivery-health state.',
          status: 'canceled',
          targetDate: '2026-07-12',
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.milestones.operations,
          workspaceId: ids.workspace,
          projectId: ids.projects.operations,
          name: 'Operations Baseline',
          description: 'Healthy portfolio comparison target with current work under control.',
          status: 'active',
          targetDate: '2026-08-07',
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
      .insert(projectCycles)
      .values([
        {
          id: ids.cycles.active,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.2.1 Cycle Planning',
          goal: 'Prove cycle planning across work assignment, reviews, reports, and exports.',
          status: 'active',
          startDate: '2026-07-01',
          endDate: '2026-07-12',
          targetPoints: 20,
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.cycles.upcoming,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.2.2 Adoption Polish',
          goal: 'Polish team adoption paths after cycle planning lands.',
          status: 'planned',
          startDate: '2026-07-20',
          endDate: '2026-07-31',
          targetPoints: 13,
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.cycles.completed,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          name: 'v0.2.0 Consolidation',
          goal: 'Consolidate the v0.1.x feature set into a cleaner product baseline.',
          status: 'completed',
          startDate: '2026-06-10',
          endDate: '2026-06-24',
          targetPoints: 8,
          archivedAt: null,
          archivedById: null,
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: projectCycles.id,
        set: {
          name: sql`excluded.name`,
          goal: sql`excluded.goal`,
          status: sql`excluded.status`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          targetPoints: sql`excluded.target_points`,
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
          cycleId: null,
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
          cycleId: ids.cycles.active,
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
          cycleId: ids.cycles.active,
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
          cycleId: ids.cycles.active,
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
          cycleId: ids.cycles.completed,
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
          cycleId: null,
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
          cycleId: null,
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
          cycleId: ids.cycles.active,
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
          cycleId: ids.cycles.active,
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
          cycleId: null,
          boardPosition: 1024,
          dueDate: '2026-07-09',
          estimatePoints: 8,
          createdAt: earlier,
          updatedAt: stale
        },
        {
          id: ids.workItems.healthyMilestone,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 9,
          displayKey: 'WT-9',
          title: 'Publish delivery health service contract',
          description: 'Assigned future work that should keep the health milestone on track.',
          type: 'task',
          status: 'ready',
          priority: 'medium',
          assigneeId: ids.members.maintainer,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.health,
          cycleId: ids.cycles.upcoming,
          boardPosition: 3072,
          dueDate: '2026-07-20',
          estimatePoints: 3,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.atRiskMilestone,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 10,
          displayKey: 'WT-10',
          title: 'Review planning health copy',
          description: 'Upcoming assigned work that should make its milestone at risk, not blocked.',
          type: 'story',
          status: 'ready',
          priority: 'high',
          assigneeId: ids.members.owner,
          reporterId: ids.members.maintainer,
          milestoneId: ids.milestones.atRisk,
          cycleId: ids.cycles.upcoming,
          boardPosition: 4096,
          dueDate: '2026-07-09',
          estimatePoints: 2,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.unmilestonedRisk,
          workspaceId: ids.workspace,
          projectId: ids.projects.app,
          itemNumber: 11,
          displayKey: 'WT-11',
          title: 'Triage unmilestoned delivery risk',
          description: 'Active work without a milestone so project health can explain unmilestoned risk.',
          type: 'bug',
          status: 'ready',
          priority: 'urgent',
          assigneeId: null,
          reporterId: ids.members.owner,
          milestoneId: null,
          cycleId: null,
          boardPosition: 5120,
          dueDate: '2026-07-09',
          estimatePoints: 1,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItems.operationsReady,
          workspaceId: ids.workspace,
          projectId: ids.projects.operations,
          itemNumber: 1,
          displayKey: 'OPS-1',
          title: 'Publish weekly operations checklist',
          description: 'Healthy active work for portfolio comparison and adoption demos.',
          type: 'task',
          status: 'ready',
          priority: 'medium',
          assigneeId: ids.members.maintainer,
          reporterId: ids.members.owner,
          milestoneId: ids.milestones.operations,
          cycleId: null,
          boardPosition: 1024,
          dueDate: '2026-08-01',
          estimatePoints: 2,
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
          cycleId: sql`excluded.cycle_id`,
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
        { workItemId: ids.workItems.platformBlocked, labelId: ids.labels.reliability },
        { workItemId: ids.workItems.healthyMilestone, labelId: ids.labels.backend },
        { workItemId: ids.workItems.atRiskMilestone, labelId: ids.labels.design },
        { workItemId: ids.workItems.unmilestonedRisk, labelId: ids.labels.reliability }
      ])
      .onConflictDoNothing();

    await tx
      .insert(workItemRelationships)
      .values([
        {
          id: ids.workItemRelationships.sameProjectBlock,
          workspaceId: ids.workspace,
          relationshipType: 'blocks',
          sourceWorkItemId: ids.workItems.inProgress,
          targetWorkItemId: ids.workItems.ready,
          createdById: ids.members.maintainer,
          createdAt: now
        },
        {
          id: ids.workItemRelationships.crossProjectBlock,
          workspaceId: ids.workspace,
          relationshipType: 'blocks',
          sourceWorkItemId: ids.workItems.platform,
          targetWorkItemId: ids.workItems.contributorOverdue,
          createdById: ids.members.owner,
          createdAt: now
        },
        {
          id: ids.workItemRelationships.relatedWork,
          workspaceId: ids.workspace,
          relationshipType: 'relates_to',
          sourceWorkItemId: ids.workItems.backlog,
          targetWorkItemId: ids.workItems.unassigned,
          createdById: ids.members.owner,
          createdAt: now
        },
        {
          id: ids.workItemRelationships.terminalBlocker,
          workspaceId: ids.workspace,
          relationshipType: 'blocks',
          sourceWorkItemId: ids.workItems.done,
          targetWorkItemId: ids.workItems.blocked,
          createdById: ids.members.owner,
          createdAt: now
        }
      ])
      .onConflictDoNothing();

    await tx
      .insert(workItemWatchers)
      .values([
        {
          id: ids.workItemWatchers.inProgressOwner,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.inProgress,
          memberId: ids.members.owner,
          watchedAt: earlier,
          unwatchedAt: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItemWatchers.inProgressMaintainer,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.inProgress,
          memberId: ids.members.maintainer,
          watchedAt: earlier,
          unwatchedAt: null,
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.workItemWatchers.inProgressContributor,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.inProgress,
          memberId: ids.members.contributor,
          watchedAt: now,
          unwatchedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: ids.workItemWatchers.readyOwner,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.ready,
          memberId: ids.members.owner,
          watchedAt: now,
          unwatchedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: ids.workItemWatchers.platformBlockedOwner,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.platformBlocked,
          memberId: ids.members.owner,
          watchedAt: now,
          unwatchedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: ids.workItemWatchers.platformBlockedContributor,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.platformBlocked,
          memberId: ids.members.contributor,
          watchedAt: now,
          unwatchedAt: null,
          createdAt: now,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: workItemWatchers.id,
        set: {
          watchedAt: sql`excluded.watched_at`,
          unwatchedAt: sql`excluded.unwatched_at`,
          updatedAt: now
        }
      });

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
          body: sql`excluded.body`,
          editedAt: sql`excluded.edited_at`,
          deletedAt: sql`excluded.deleted_at`,
          deletedById: sql`excluded.deleted_by_id`,
          updatedAt: now
        }
      });

    await tx
      .insert(commentMentions)
      .values([
        {
          commentId: ids.comments.second,
          memberId: ids.members.owner,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.inProgress,
          createdAt: now
        },
        {
          commentId: ids.comments.second,
          memberId: ids.members.contributor,
          workspaceId: ids.workspace,
          workItemId: ids.workItems.inProgress,
          createdAt: now
        }
      ])
      .onConflictDoNothing();

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
      .insert(notifications)
      .values([
        {
          id: ids.notifications.ownerWatchedStatus,
          workspaceId: ids.workspace,
          recipientMemberId: ids.members.owner,
          actorMemberId: ids.members.maintainer,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          activityEventId: ids.activity.status,
          notificationType: 'watched_status_change',
          summary: 'WT-3 moved from ready to in_progress.',
          metadata: { previousStatus: 'ready', status: 'in_progress' },
          sourceEventKey: `seed:${ids.workItems.inProgress}:status:owner`,
          readAt: null,
          createdAt: now
        },
        {
          id: ids.notifications.ownerDependency,
          workspaceId: ids.workspace,
          recipientMemberId: ids.members.owner,
          actorMemberId: ids.members.owner,
          projectId: ids.projects.platform,
          workItemId: ids.workItems.platformBlocked,
          activityEventId: null,
          notificationType: 'dependency_blocker_added',
          summary: 'CLOUD-1 is blocking CLOUD-2.',
          metadata: {
            relationshipId: ids.workItemRelationships.crossProjectBlock,
            relationshipType: 'blocks',
            action: 'added',
            sourceWorkItemId: ids.workItems.platform,
            sourceDisplayKey: 'CLOUD-1',
            targetWorkItemId: ids.workItems.platformBlocked,
            targetDisplayKey: 'CLOUD-2'
          },
          sourceEventKey: `seed:${ids.workItemRelationships.crossProjectBlock}:dependency:owner`,
          readAt: null,
          createdAt: now
        },
        {
          id: ids.notifications.contributorMention,
          workspaceId: ids.workspace,
          recipientMemberId: ids.members.contributor,
          actorMemberId: ids.members.maintainer,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          activityEventId: ids.activity.comment,
          notificationType: 'mention',
          summary: 'You were mentioned on WT-3.',
          metadata: { commentId: ids.comments.second },
          sourceEventKey: `seed:${ids.comments.second}:mention:contributor`,
          readAt: null,
          createdAt: now
        },
        {
          id: ids.notifications.maintainerReadAssignment,
          workspaceId: ids.workspace,
          recipientMemberId: ids.members.maintainer,
          actorMemberId: ids.members.owner,
          projectId: ids.projects.app,
          workItemId: ids.workItems.inProgress,
          activityEventId: ids.activity.assignee,
          notificationType: 'assignment',
          summary: 'WT-3 was assigned to you.',
          metadata: {
            previousAssigneeId: null,
            assigneeId: ids.members.maintainer
          },
          sourceEventKey: `seed:${ids.workItems.inProgress}:assignment:maintainer`,
          readAt: now,
          createdAt: now
        }
      ])
      .onConflictDoUpdate({
        target: notifications.id,
        set: {
          summary: sql`excluded.summary`,
          metadata: sql`excluded.metadata`,
          sourceEventKey: sql`excluded.source_event_key`,
          readAt: sql`excluded.read_at`,
          createdAt: sql`excluded.created_at`
        }
      });

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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
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
          ...workspaceSavedViewDefaults,
          name: 'Unassigned work',
          visibility: 'personal',
          query: { assigneeState: 'unassigned', archivedProjects: 'exclude', sort: 'updated_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.workspaceBlocked,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          ...workspaceSavedViewDefaults,
          name: 'Blocked work',
          visibility: 'workspace',
          query: { blocked: true, archivedProjects: 'exclude', sort: 'priority_desc' },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.workspaceDependencyRisks,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          ...workspaceSavedViewDefaults,
          name: 'Dependency risks',
          visibility: 'workspace',
          isPinned: true,
          query: {
            dependency: 'dependency_blocked',
            archivedProjects: 'exclude',
            sort: 'priority_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.workspaceDueSoon,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          ...workspaceSavedViewDefaults,
          name: 'Due soon',
          visibility: 'workspace',
          query: {
            dueDateState: 'due_soon',
            workState: 'open',
            archivedProjects: 'exclude',
            sort: 'due_date_asc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.workspaceUnassignedOpen,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          ...workspaceSavedViewDefaults,
          name: 'Unassigned open work',
          visibility: 'workspace',
          query: {
            assigneeState: 'unassigned',
            workState: 'open',
            archivedProjects: 'exclude',
            sort: 'updated_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.workspaceReadyForPickup,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          ...workspaceSavedViewDefaults,
          name: 'Ready for pickup',
          visibility: 'workspace',
          isPinned: true,
          query: {
            status: 'ready',
            assigneeState: 'unassigned',
            archivedProjects: 'exclude',
            sort: 'board_order'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appReleaseBlockers,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Release blockers',
          visibility: 'workspace',
          isPinned: true,
          query: {
            blocked: true,
            sort: 'priority_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appReadyForQa,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Ready for QA',
          visibility: 'workspace',
          isPinned: true,
          query: {
            status: 'ready',
            sort: 'board_order'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appUnassignedProjectWork,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Unassigned project work',
          visibility: 'workspace',
          query: {
            assigneeState: 'unassigned',
            workState: 'open',
            sort: 'updated_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appCurrentMilestoneRisk,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Current milestone risk',
          visibility: 'workspace',
          query: {
            milestoneId: ids.milestones.atRisk,
            workState: 'open',
            sort: 'due_date_asc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appOpenDependencyRisks,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Open dependency risks',
          visibility: 'workspace',
          query: {
            dependency: 'dependency_blocked',
            workState: 'open',
            sort: 'priority_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.appCurrentCycleRisk,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'Current cycle risks',
          visibility: 'workspace',
          isPinned: true,
          query: {
            cycleId: ids.cycles.active,
            workState: 'open',
            sort: 'priority_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.ownerAppOpenWork,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.app,
          scope: 'project',
          name: 'My app work',
          visibility: 'personal',
          query: {
            assigneeId: ids.members.owner,
            workState: 'open',
            sort: 'updated_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.platformReleaseBlockers,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.platform,
          scope: 'project',
          name: 'Release blockers',
          visibility: 'workspace',
          query: {
            blocked: true,
            sort: 'priority_desc'
          },
          createdAt: earlier,
          updatedAt: now
        },
        {
          id: ids.savedWorkViews.platformReadyForQa,
          workspaceId: ids.workspace,
          ownerMemberId: ids.members.owner,
          projectId: ids.projects.platform,
          scope: 'project',
          name: 'Ready for QA',
          visibility: 'workspace',
          query: {
            status: 'ready',
            sort: 'board_order'
          },
          createdAt: earlier,
          updatedAt: now
        }
      ])
      .onConflictDoUpdate({
        target: savedWorkViews.id,
        set: {
          ownerMemberId: sql`excluded.owner_member_id`,
          projectId: sql`excluded.project_id`,
          name: sql`excluded.name`,
          scope: sql`excluded.scope`,
          visibility: sql`excluded.visibility`,
          isPinned: sql`excluded.is_pinned`,
          query: sql`excluded.query`,
          updatedAt: now
        }
      });
  });

  const seededReportIds = [
    ids.statusReports.appWeekly,
    ids.activity.statusReport,
    ids.statusReports.operationsWeekly,
    ids.activity.operationsStatusReport
  ];
  const reportService = new ProjectStatusReportService({
    actor: localSeedActor,
    db,
    repositories: createRepositories(db),
    clock: () => now,
    idGenerator: () => {
      const id = seededReportIds.shift();

      if (id === undefined) {
        throw new Error('Seed status report id sequence exhausted.');
      }

      return id;
    }
  });

  await reportService.publishProjectStatusReport(ids.projects.app, {
    title: 'Worktrail App weekly status',
    statusDate: '2026-07-03',
    summary:
      'Worktrail App is progressing through the core reference workflows, with delivery health intentionally showing blocked and overdue work so teams can inspect risk surfaces from seeded data.',
    highlights:
      'Planning, board, saved view, dependency, inbox, import/export, milestone review, and delivery-health workflows are available from a clean local seed.',
    risks:
      'Current risk remains concentrated around blocked project work, overdue assigned work, and unassigned delivery items. These are seeded intentionally to exercise status report links and planning review.',
    nextSteps:
      'Use the project Status area to review this seeded report, publish a fresh report, and follow risk links into current project work.'
  });

  await reportService.publishProjectStatusReport(ids.projects.operations, {
    title: 'Reference Operations weekly status',
    statusDate: '2026-07-03',
    summary:
      'Reference Operations is on track with one planned checklist item and no elevated delivery risks.',
    highlights:
      'The project gives the Portfolio review a healthy active-project comparison alongside riskier seeded projects.',
    risks: 'No material delivery risks are currently tracked for this seeded project.',
    nextSteps:
      'Use Portfolio to compare this steady project against blocked and dependency-heavy projects.'
  });

  console.log('Database seed data applied.');
} finally {
  await pool.end();
}
