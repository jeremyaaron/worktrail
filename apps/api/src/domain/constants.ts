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
export const milestoneStatuses = ['planned', 'active', 'completed', 'canceled'] as const;
export const activityEventTypes = [
  'project.name_changed',
  'project.description_changed',
  'project.archived',
  'project.reactivated',
  'milestone.created',
  'milestone.name_changed',
  'milestone.description_changed',
  'milestone.status_changed',
  'milestone.target_date_changed',
  'milestone.archived',
  'milestone.reactivated',
  'label.created',
  'label.name_changed',
  'label.color_changed',
  'label.archived',
  'label.reactivated',
  'work_item.created',
  'work_item.title_changed',
  'work_item.description_changed',
  'work_item.status_changed',
  'work_item.assignee_changed',
  'work_item.priority_changed',
  'work_item.milestone_changed',
  'work_item.label_added',
  'work_item.label_removed',
  'comment.added',
  'comment.edited',
  'comment.deleted'
] as const;
export const workspaceActivityEventTypes = [
  'member.created',
  'member.name_changed',
  'member.email_changed',
  'member.role_changed',
  'member.deactivated',
  'member.reactivated',
  'workspace.name_changed',
  'project.created'
] as const;

export type MemberRole = (typeof memberRoles)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export type WorkItemType = (typeof workItemTypes)[number];
export type WorkItemStatus = (typeof workItemStatuses)[number];
export type WorkItemPriority = (typeof workItemPriorities)[number];
export type MilestoneStatus = (typeof milestoneStatuses)[number];
export type ActivityEventType = (typeof activityEventTypes)[number];
export type WorkspaceActivityEventType = (typeof workspaceActivityEventTypes)[number];

export const terminalWorkItemStatuses = ['done', 'canceled'] as const satisfies readonly WorkItemStatus[];
export const openWorkItemStatuses = [
  'backlog',
  'ready',
  'in_progress',
  'blocked'
] as const satisfies readonly WorkItemStatus[];
