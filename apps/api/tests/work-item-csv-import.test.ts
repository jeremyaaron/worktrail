import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPool } from '../src/db/client.js';
import type { ActorContext } from '../src/domain/actor.js';
import { ConflictError, ValidationError } from '../src/errors/app-error.js';
import { createRepositories, type Repositories } from '../src/repositories/index.js';
import { WorkItemCsvImportService } from '../src/services/work-item-csv-import-service.js';

const workspaceIds = new Set<string>();
let pool: ReturnType<typeof createPool>;
let db: ReturnType<typeof createDb>;
let repositories: Repositories;

function now() {
  return new Date('2026-07-05T12:00:00.000Z');
}

async function cleanupWorkspace(workspaceId: string) {
  await pool.query('delete from activity_events where workspace_id = $1', [workspaceId]);
  await pool.query('delete from comments where workspace_id = $1', [workspaceId]);
  await pool.query(
    'delete from work_item_labels where work_item_id in (select id from work_items where workspace_id = $1)',
    [workspaceId]
  );
  await pool.query('delete from labels where workspace_id = $1', [workspaceId]);
  await pool.query('delete from work_items where workspace_id = $1', [workspaceId]);
  await pool.query('delete from milestones where workspace_id = $1', [workspaceId]);
  await pool.query('delete from projects where workspace_id = $1', [workspaceId]);
  await pool.query('delete from members where workspace_id = $1', [workspaceId]);
  await pool.query('delete from workspaces where id = $1', [workspaceId]);
}

async function cleanupAllWorkspaces() {
  for (const workspaceId of workspaceIds) {
    await cleanupWorkspace(workspaceId);
  }
  workspaceIds.clear();
}

async function createFixture() {
  const timestamp = now();
  const workspaceId = randomUUID();
  const actorId = randomUUID();
  const maintainerId = randomUUID();
  const contributorId = randomUUID();
  const inactiveMemberId = randomUUID();
  const projectId = randomUUID();
  const archivedProjectId = randomUUID();
  const backendLabelId = randomUUID();
  const designLabelId = randomUUID();
  const milestoneId = randomUUID();
  workspaceIds.add(workspaceId);

  await repositories.workspaces.create({
    id: workspaceId,
    name: 'CSV Import Test Workspace',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.members.create({
    id: actorId,
    workspaceId,
    name: 'Avery Owner',
    email: 'avery.owner@example.com',
    role: 'owner',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.members.create({
    id: maintainerId,
    workspaceId,
    name: 'Morgan Maintainer',
    email: 'morgan.maintainer@example.com',
    role: 'maintainer',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.members.create({
    id: contributorId,
    workspaceId,
    name: 'Casey Contributor',
    email: 'casey.contributor@example.com',
    role: 'contributor',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.members.create({
    id: inactiveMemberId,
    workspaceId,
    name: 'Inactive Contributor',
    email: 'inactive.contributor@example.com',
    role: 'contributor',
    isActive: false,
    deactivatedAt: new Date('2026-07-01T12:00:00.000Z'),
    deactivatedById: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.projects.create({
    id: projectId,
    workspaceId,
    key: 'CSV',
    nextWorkItemNumber: 1,
    name: 'CSV Import Test Project',
    description: 'Project for import preview tests.',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.projects.create({
    id: archivedProjectId,
    workspaceId,
    key: 'OLD',
    nextWorkItemNumber: 1,
    name: 'Archived Import Test Project',
    description: 'Archived project for import preview tests.',
    status: 'archived',
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.labels.create({
    id: backendLabelId,
    workspaceId,
    projectId,
    name: 'backend',
    color: '#059669',
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.labels.create({
    id: designLabelId,
    workspaceId,
    projectId,
    name: 'Design',
    color: '#7c3aed',
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.labels.create({
    id: randomUUID(),
    workspaceId,
    projectId,
    name: 'archived',
    color: '#64748b',
    archivedAt: timestamp,
    archivedById: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await repositories.milestones.create({
    id: milestoneId,
    workspaceId,
    projectId,
    name: 'v0.0.7',
    description: 'Import/export release.',
    status: 'active',
    targetDate: '2026-07-31',
    archivedAt: null,
    archivedById: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await repositories.milestones.create({
    id: randomUUID(),
    workspaceId,
    projectId,
    name: 'legacy',
    description: '',
    status: 'canceled',
    targetDate: null,
    archivedAt: timestamp,
    archivedById: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const actor: ActorContext = {
    workspaceId,
    memberId: actorId,
    role: 'owner'
  };

  return {
    workspaceId,
    actorId,
    maintainerId,
    contributorId,
    inactiveMemberId,
    projectId,
    archivedProjectId,
    backendLabelId,
    designLabelId,
    milestoneId,
    actor
  };
}

function createService(actor: ActorContext) {
  return new WorkItemCsvImportService({
    actor,
    repositories,
    db
  });
}

beforeAll(() => {
  pool = createPool();
  db = createDb(pool);
  repositories = createRepositories(db);
});

afterEach(async () => {
  await cleanupAllWorkspaces();
});

afterAll(async () => {
  await cleanupAllWorkspaces();
  await pool.end();
});

describe('work item CSV import validation', () => {
  it('returns normalized preview rows with defaults and case-insensitive lookups', async () => {
    const fixture = await createFixture();
    const service = createService(fixture.actor);

    const preview = await service.preview(
      fixture.projectId,
      [
        'title,description,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points',
        '"Draft import, checklist",Prepare team onboarding,task,ready,medium,MORGAN.MAINTAINER@example.com,CASEY.CONTRIBUTOR@example.com,"BACKEND, backend, design",V0.0.7,2026-07-31,3',
        'Defaulted row,,story,,high,,,,,,'
      ].join('\n')
    );

    expect(preview).toMatchObject({
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      errors: [],
      warnings: []
    });
    expect(preview.rows).toEqual([
      {
        rowNumber: 2,
        title: 'Draft import, checklist',
        type: 'task',
        status: 'ready',
        priority: 'medium',
        assigneeEmail: 'morgan.maintainer@example.com',
        reporterEmail: 'casey.contributor@example.com',
        labelNames: ['backend', 'Design'],
        milestoneName: 'v0.0.7',
        dueDate: '2026-07-31',
        estimatePoints: 3
      },
      {
        rowNumber: 3,
        title: 'Defaulted row',
        type: 'story',
        status: 'backlog',
        priority: 'high',
        assigneeEmail: null,
        reporterEmail: 'avery.owner@example.com',
        labelNames: [],
        milestoneName: null,
        dueDate: null,
        estimatePoints: null
      }
    ]);

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(0);
  });

  it('returns row-level errors for invalid values and unknown references without writing', async () => {
    const fixture = await createFixture();
    const service = createService(fixture.actor);

    const preview = await service.preview(
      fixture.projectId,
      [
        'title,type,status,priority,assignee_email,reporter_email,label_names,milestone_name,due_date,estimate_points',
        ',feature,unknown,extreme,inactive.contributor@example.com,missing@example.com,"backend,missing-label",legacy,2026-02-31,-1'
      ].join('\n')
    );

    expect(preview.totalRows).toBe(1);
    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows).toEqual([]);
    expect(preview.errors).toEqual([
      {
        rowNumber: 2,
        field: 'title',
        message: 'CSV field "title" is required.'
      },
      {
        rowNumber: 2,
        field: 'type',
        message: 'CSV field "type" must be one of task, bug, story, chore.'
      },
      {
        rowNumber: 2,
        field: 'status',
        message: 'CSV field "status" must be one of backlog, ready, in_progress, blocked, done, canceled.'
      },
      {
        rowNumber: 2,
        field: 'priority',
        message: 'CSV field "priority" must be one of low, medium, high, urgent.'
      },
      {
        rowNumber: 2,
        field: 'assignee_email',
        message: 'Member "inactive.contributor@example.com" was not found.'
      },
      {
        rowNumber: 2,
        field: 'reporter_email',
        message: 'Member "missing@example.com" was not found.'
      },
      {
        rowNumber: 2,
        field: 'label_names',
        message: 'Label "missing-label" was not found.'
      },
      {
        rowNumber: 2,
        field: 'milestone_name',
        message: 'Milestone "legacy" was not found.'
      },
      {
        rowNumber: 2,
        field: 'due_date',
        message: 'CSV field "due_date" must be a valid YYYY-MM-DD date.'
      },
      {
        rowNumber: 2,
        field: 'estimate_points',
        message: 'CSV field "estimate_points" must be a non-negative integer.'
      }
    ]);

    const workItems = await repositories.workItems.listByProject(fixture.projectId);
    expect(workItems).toHaveLength(0);
  });

  it('returns file-level header and parser errors', async () => {
    const fixture = await createFixture();
    const service = createService(fixture.actor);

    await expect(service.preview(fixture.projectId, 'title,external_id\nExample,ABC-1\n')).resolves.toEqual({
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      warnings: [],
      rows: [],
      errors: [
        {
          rowNumber: 1,
          field: 'external_id',
          message: 'CSV header "external_id" is not supported.'
        },
        {
          rowNumber: 1,
          field: 'type',
          message: 'CSV header "type" is required.'
        },
        {
          rowNumber: 1,
          field: 'priority',
          message: 'CSV header "priority" is required.'
        }
      ]
    });

    await expect(service.preview(fixture.projectId, 'title,type,priority\n"unterminated,task,medium\n'))
      .resolves.toMatchObject({
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            rowNumber: null,
            field: null,
            message: 'CSV could not be parsed.'
          }
        ]
      });
  });

  it('enforces import size, row, label, and cell limits', async () => {
    const fixture = await createFixture();
    const service = createService(fixture.actor);
    const tooManyRowsCsv = [
      'title,type,priority',
      ...Array.from({ length: 251 }, (_, index) => `Task ${index + 1},task,medium`)
    ].join('\n');

    await expect(service.preview(fixture.projectId, `${'x'.repeat(1024 * 1024)}x`)).rejects.toThrow(
      ValidationError
    );
    await expect(service.preview(fixture.projectId, tooManyRowsCsv)).rejects.toThrow(
      'CSV imports can include at most 250 data rows.'
    );

    const labelNames = Array.from({ length: 21 }, (_, index) => `label-${index + 1}`).join(',');
    const preview = await service.preview(
      fixture.projectId,
      [
        'title,type,priority,label_names,description',
        `"${'A'.repeat(10_001)}",task,medium,"${labelNames}",ok`
      ].join('\n')
    );

    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(1);
    expect(preview.errors).toEqual([
      {
        rowNumber: 2,
        field: 'title',
        message: 'CSV field "title" cannot exceed 10000 characters.'
      },
      {
        rowNumber: 2,
        field: 'label_names',
        message: 'CSV field "label_names" can include at most 20 labels.'
      }
    ]);
  });

  it('rejects archived project imports', async () => {
    const fixture = await createFixture();
    const service = createService(fixture.actor);

    await expect(
      service.preview(fixture.archivedProjectId, 'title,type,priority\nArchived import,task,medium\n')
    ).rejects.toThrow(ConflictError);
  });
});
