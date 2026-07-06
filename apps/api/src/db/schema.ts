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
  uuid,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import {
  type ActivityEventType,
  type MemberRole,
  type MilestoneStatus,
  type NotificationType,
  type ProjectStatus,
  type SavedWorkViewScope,
  type SavedWorkViewVisibility,
  type WorkItemPriority,
  type WorkItemRelationshipType,
  type WorkItemStatus,
  type WorkItemType,
  type WorkspaceActivityEventType,
  activityEventTypes,
  memberRoles,
  milestoneStatuses,
  notificationTypes,
  projectStatuses,
  savedWorkViewScopes,
  savedWorkViewVisibilities,
  workItemPriorities,
  workItemRelationshipTypes,
  workItemStatuses,
  workItemTypes,
  workspaceActivityEventTypes
} from '../domain/constants.js';

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
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    deactivatedById: uuid('deactivated_by_id').references((): AnyPgColumn => members.id),
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
    key: text('key').notNull(),
    nextWorkItemNumber: integer('next_work_item_number').notNull().default(1),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<ProjectStatus>().notNull(),
    ...timestamps
  },
  (table) => [
    check('projects_status_check', enumCheckSql('status', projectStatuses)),
    check('projects_key_check', sql`${table.key} ~ '^[A-Z0-9]{2,8}$'`),
    check('projects_next_work_item_number_check', sql`${table.nextWorkItemNumber} > 0`),
    index('projects_workspace_id_status_idx').on(table.workspaceId, table.status),
    uniqueIndex('projects_workspace_id_key_unique').on(table.workspaceId, table.key)
  ]
);

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<MilestoneStatus>().notNull(),
    targetDate: date('target_date', { mode: 'string' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedById: uuid('archived_by_id').references(() => members.id),
    ...timestamps
  },
  (table) => [
    check('milestones_status_check', enumCheckSql('status', milestoneStatuses)),
    index('milestones_project_id_status_idx').on(table.projectId, table.status),
    index('milestones_project_id_target_date_idx').on(table.projectId, table.targetDate),
    index('milestones_project_id_archived_at_idx').on(table.projectId, table.archivedAt),
    uniqueIndex('milestones_project_id_active_name_unique')
      .on(table.projectId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`)
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
    itemNumber: integer('item_number').notNull(),
    displayKey: text('display_key').notNull(),
    type: text('type').$type<WorkItemType>().notNull(),
    status: text('status').$type<WorkItemStatus>().notNull(),
    priority: text('priority').$type<WorkItemPriority>().notNull(),
    assigneeId: uuid('assignee_id').references(() => members.id),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => members.id),
    milestoneId: uuid('milestone_id').references(() => milestones.id),
    boardPosition: integer('board_position').notNull().default(0),
    dueDate: date('due_date', { mode: 'string' }),
    estimatePoints: integer('estimate_points'),
    ...timestamps
  },
  (table) => [
    check('work_items_type_check', enumCheckSql('type', workItemTypes)),
    check('work_items_status_check', enumCheckSql('status', workItemStatuses)),
    check('work_items_priority_check', enumCheckSql('priority', workItemPriorities)),
    check('work_items_item_number_check', sql`${table.itemNumber} > 0`),
    index('work_items_project_id_status_idx').on(table.projectId, table.status),
    index('work_items_project_id_assignee_id_idx').on(table.projectId, table.assigneeId),
    index('work_items_project_id_type_idx').on(table.projectId, table.type),
    index('work_items_project_id_priority_idx').on(table.projectId, table.priority),
    index('work_items_project_id_milestone_id_idx').on(table.projectId, table.milestoneId),
    index('work_items_project_id_status_board_position_idx').on(
      table.projectId,
      table.status,
      table.boardPosition
    ),
    index('work_items_project_id_due_date_idx').on(table.projectId, table.dueDate),
    index('work_items_project_id_reporter_id_idx').on(table.projectId, table.reporterId),
    index('work_items_project_id_updated_at_idx').on(table.projectId, table.updatedAt.desc()),
    index('work_items_project_id_title_idx').on(table.projectId, table.title),
    index('work_items_workspace_id_status_idx').on(table.workspaceId, table.status),
    index('work_items_workspace_id_assignee_id_idx').on(table.workspaceId, table.assigneeId),
    index('work_items_workspace_id_reporter_id_idx').on(table.workspaceId, table.reporterId),
    index('work_items_workspace_id_priority_idx').on(table.workspaceId, table.priority),
    index('work_items_workspace_id_due_date_idx').on(table.workspaceId, table.dueDate),
    index('work_items_workspace_id_updated_at_idx').on(table.workspaceId, table.updatedAt.desc()),
    uniqueIndex('work_items_project_id_item_number_unique').on(table.projectId, table.itemNumber),
    uniqueIndex('work_items_workspace_id_display_key_unique').on(table.workspaceId, table.displayKey)
  ]
);

export const workItemRelationships = pgTable(
  'work_item_relationships',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    relationshipType: text('relationship_type').$type<WorkItemRelationshipType>().notNull(),
    sourceWorkItemId: uuid('source_work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    targetWorkItemId: uuid('target_work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    check('work_item_relationships_type_check', enumCheckSql('relationship_type', workItemRelationshipTypes)),
    check('work_item_relationships_no_self_check', sql`${table.sourceWorkItemId} <> ${table.targetWorkItemId}`),
    index('work_item_relationships_workspace_id_idx').on(table.workspaceId),
    index('work_item_relationships_source_work_item_id_idx').on(table.sourceWorkItemId),
    index('work_item_relationships_target_work_item_id_idx').on(table.targetWorkItemId),
    uniqueIndex('work_item_relationships_unique').on(
      table.workspaceId,
      table.relationshipType,
      table.sourceWorkItemId,
      table.targetWorkItemId
    )
  ]
);

export const workItemWatchers = pgTable(
  'work_item_watchers',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    watchedAt: timestamp('watched_at', { withTimezone: true }).notNull(),
    unwatchedAt: timestamp('unwatched_at', { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    index('work_item_watchers_workspace_member_unwatched_idx').on(
      table.workspaceId,
      table.memberId,
      table.unwatchedAt
    ),
    index('work_item_watchers_work_item_unwatched_idx').on(table.workItemId, table.unwatchedAt),
    uniqueIndex('work_item_watchers_active_unique')
      .on(table.workItemId, table.memberId)
      .where(sql`${table.unwatchedAt} is null`)
  ]
);

export const savedWorkViews = pgTable(
  'saved_work_views',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    ownerMemberId: uuid('owner_member_id')
      .notNull()
      .references(() => members.id),
    projectId: uuid('project_id').references(() => projects.id),
    name: text('name').notNull(),
    scope: text('scope').$type<SavedWorkViewScope>().notNull().default('workspace'),
    visibility: text('visibility').$type<SavedWorkViewVisibility>().notNull(),
    query: jsonb('query').$type<Record<string, unknown>>().notNull(),
    ...timestamps
  },
  (table) => [
    check('saved_work_views_scope_check', enumCheckSql('scope', savedWorkViewScopes)),
    check('saved_work_views_visibility_check', enumCheckSql('visibility', savedWorkViewVisibilities)),
    check(
      'saved_work_views_scope_project_check',
      sql`((${table.scope} = 'workspace' and ${table.projectId} is null) or (${table.scope} = 'project' and ${table.projectId} is not null))`
    ),
    index('saved_work_views_workspace_owner_updated_idx').on(
      table.workspaceId,
      table.ownerMemberId,
      table.updatedAt.desc()
    ),
    index('saved_work_views_workspace_scope_updated_idx').on(
      table.workspaceId,
      table.scope,
      table.updatedAt.desc()
    ),
    index('saved_work_views_project_scope_updated_idx')
      .on(table.workspaceId, table.projectId, table.scope, table.updatedAt.desc())
      .where(sql`${table.scope} = 'project'`),
    uniqueIndex('saved_work_views_workspace_personal_name_unique')
      .on(table.workspaceId, table.ownerMemberId, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'workspace' and ${table.visibility} = 'personal'`),
    uniqueIndex('saved_work_views_workspace_shared_name_unique')
      .on(table.workspaceId, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'workspace' and ${table.visibility} = 'workspace'`),
    uniqueIndex('saved_work_views_project_personal_name_unique')
      .on(table.workspaceId, table.projectId, table.ownerMemberId, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'project' and ${table.visibility} = 'personal'`),
    uniqueIndex('saved_work_views_project_shared_name_unique')
      .on(table.workspaceId, table.projectId, sql`lower(${table.name})`)
      .where(sql`${table.scope} = 'project' and ${table.visibility} = 'workspace'`)
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
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedById: uuid('archived_by_id').references(() => members.id),
    ...timestamps
  },
  (table) => [
    index('labels_workspace_id_name_idx').on(table.workspaceId, table.name),
    index('labels_project_id_archived_at_idx').on(table.projectId, table.archivedAt),
    uniqueIndex('labels_project_id_active_name_unique')
      .on(table.projectId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`)
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
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => members.id),
    ...timestamps
  },
  (table) => [index('comments_work_item_id_created_at_idx').on(table.workItemId, table.createdAt)]
);

export const commentMentions = pgTable(
  'comment_mentions',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.memberId] }),
    index('comment_mentions_workspace_member_created_idx').on(
      table.workspaceId,
      table.memberId,
      table.createdAt.desc()
    ),
    index('comment_mentions_work_item_created_idx').on(table.workItemId, table.createdAt.desc())
  ]
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

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    recipientMemberId: uuid('recipient_member_id')
      .notNull()
      .references(() => members.id),
    actorMemberId: uuid('actor_member_id').references(() => members.id),
    projectId: uuid('project_id').references(() => projects.id),
    workItemId: uuid('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
    activityEventId: uuid('activity_event_id').references(() => activityEvents.id, {
      onDelete: 'set null'
    }),
    notificationType: text('notification_type').$type<NotificationType>().notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    sourceEventKey: text('source_event_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    check('notifications_type_check', enumCheckSql('notification_type', notificationTypes)),
    index('notifications_workspace_recipient_read_created_idx').on(
      table.workspaceId,
      table.recipientMemberId,
      table.readAt,
      table.createdAt.desc()
    ),
    index('notifications_workspace_recipient_created_idx').on(
      table.workspaceId,
      table.recipientMemberId,
      table.createdAt.desc()
    ),
    index('notifications_work_item_created_idx').on(table.workItemId, table.createdAt.desc()),
    uniqueIndex('notifications_recipient_source_event_unique')
      .on(table.recipientMemberId, table.sourceEventKey)
      .where(sql`${table.sourceEventKey} is not null`)
  ]
);

export const workspaceActivityEvents = pgTable(
  'workspace_activity_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => members.id),
    eventType: text('event_type').$type<WorkspaceActivityEventType>().notNull(),
    summary: text('summary').notNull(),
    previousValue: jsonb('previous_value').$type<Record<string, unknown> | null>(),
    newValue: jsonb('new_value').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull()
  },
  (table) => [
    check(
      'workspace_activity_events_event_type_check',
      enumCheckSql('event_type', workspaceActivityEventTypes)
    ),
    index('workspace_activity_events_workspace_id_created_at_idx').on(
      table.workspaceId,
      table.createdAt.desc()
    ),
    index('workspace_activity_events_actor_id_idx').on(table.actorId)
  ]
);
