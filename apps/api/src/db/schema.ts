import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const memberRoles = ['owner', 'maintainer', 'contributor'] as const;
export const projectStatuses = ['active', 'archived'] as const;
export const workItemTypes = ['task', 'bug', 'story', 'chore'] as const;
export const workItemStatuses = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'done',
  'canceled'
] as const;
export const workItemPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export const activityEventTypes = [
  'work_item.created',
  'work_item.title_changed',
  'work_item.description_changed',
  'work_item.status_changed',
  'work_item.assignee_changed',
  'work_item.priority_changed',
  'work_item.label_added',
  'work_item.label_removed',
  'comment.added'
] as const;

export type MemberRole = (typeof memberRoles)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export type WorkItemType = (typeof workItemTypes)[number];
export type WorkItemStatus = (typeof workItemStatuses)[number];
export type WorkItemPriority = (typeof workItemPriorities)[number];
export type ActivityEventType = (typeof activityEventTypes)[number];

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
};

function enumCheckSql(columnName: string, values: readonly string[]) {
  return sql.raw(`${columnName} in (${values.map((value) => `'${value}'`).join(', ')})`);
}

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  ...timestamps
});

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: text('role').$type<MemberRole>().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps
  },
  (table) => [
    check('members_role_check', enumCheckSql('role', memberRoles)),
    index('members_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('members_workspace_id_email_unique').on(table.workspaceId, table.email)
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<ProjectStatus>().notNull(),
    ...timestamps
  },
  (table) => [
    check('projects_status_check', enumCheckSql('status', projectStatuses)),
    index('projects_workspace_id_status_idx').on(table.workspaceId, table.status)
  ]
);

export const workItems = pgTable(
  'work_items',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    type: text('type').$type<WorkItemType>().notNull(),
    status: text('status').$type<WorkItemStatus>().notNull(),
    priority: text('priority').$type<WorkItemPriority>().notNull(),
    assigneeId: uuid('assignee_id').references(() => members.id),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => members.id),
    dueDate: date('due_date', { mode: 'string' }),
    estimatePoints: integer('estimate_points'),
    ...timestamps
  },
  (table) => [
    check('work_items_type_check', enumCheckSql('type', workItemTypes)),
    check('work_items_status_check', enumCheckSql('status', workItemStatuses)),
    check('work_items_priority_check', enumCheckSql('priority', workItemPriorities)),
    index('work_items_project_id_status_idx').on(table.projectId, table.status),
    index('work_items_project_id_assignee_id_idx').on(table.projectId, table.assigneeId),
    index('work_items_project_id_type_idx').on(table.projectId, table.type),
    index('work_items_project_id_priority_idx').on(table.projectId, table.priority),
    index('work_items_project_id_updated_at_idx').on(table.projectId, table.updatedAt.desc()),
    index('work_items_project_id_title_idx').on(table.projectId, table.title)
  ]
);

export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id').references(() => projects.id),
    name: text('name').notNull(),
    color: text('color'),
    ...timestamps
  },
  (table) => [
    index('labels_workspace_id_name_idx').on(table.workspaceId, table.name),
    uniqueIndex('labels_project_id_name_unique').on(table.projectId, table.name)
  ]
);

export const workItemLabels = pgTable(
  'work_item_labels',
  {
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id)
  },
  (table) => [
    primaryKey({ columns: [table.workItemId, table.labelId] }),
    index('work_item_labels_label_id_idx').on(table.labelId)
  ]
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => members.id),
    body: text('body').notNull(),
    ...timestamps
  },
  (table) => [index('comments_work_item_id_created_at_idx').on(table.workItemId, table.createdAt)]
);

export const activityEvents = pgTable(
  'activity_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    workItemId: uuid('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => members.id),
    eventType: text('event_type').$type<ActivityEventType>().notNull(),
    summary: text('summary').notNull(),
    previousValue: jsonb('previous_value').$type<Record<string, unknown> | null>(),
    newValue: jsonb('new_value').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    check('activity_events_event_type_check', enumCheckSql('event_type', activityEventTypes)),
    index('activity_events_work_item_id_created_at_idx').on(table.workItemId, table.createdAt.desc()),
    index('activity_events_project_id_created_at_idx').on(table.projectId, table.createdAt.desc())
  ]
);
