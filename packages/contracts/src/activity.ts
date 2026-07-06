import type { MemberDto } from './members.js';

export type ActivityEventType =
  | 'project.name_changed'
  | 'project.description_changed'
  | 'project.archived'
  | 'project.reactivated'
  | 'milestone.created'
  | 'milestone.name_changed'
  | 'milestone.description_changed'
  | 'milestone.status_changed'
  | 'milestone.target_date_changed'
  | 'milestone.archived'
  | 'milestone.reactivated'
  | 'label.created'
  | 'label.name_changed'
  | 'label.color_changed'
  | 'label.archived'
  | 'label.reactivated'
  | 'work_item.created'
  | 'work_item.title_changed'
  | 'work_item.description_changed'
  | 'work_item.status_changed'
  | 'work_item.assignee_changed'
  | 'work_item.priority_changed'
  | 'work_item.milestone_changed'
  | 'work_item.label_added'
  | 'work_item.label_removed'
  | 'work_item.relationship_added'
  | 'work_item.relationship_removed'
  | 'comment.added'
  | 'comment.edited'
  | 'comment.deleted';

export type WorkspaceActivityEventType =
  | 'member.created'
  | 'member.name_changed'
  | 'member.email_changed'
  | 'member.role_changed'
  | 'member.deactivated'
  | 'member.reactivated'
  | 'workspace.name_changed'
  | 'project.created'
  | 'saved_view.created'
  | 'saved_view.name_changed'
  | 'saved_view.query_changed'
  | 'saved_view.updated'
  | 'saved_view.deleted';

export interface WorkspaceActivityEventDto {
  id: string;
  workspaceId: string;
  actor: MemberDto;
  eventType: WorkspaceActivityEventType;
  summary: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityEventDto {
  id: string;
  workspaceId: string;
  projectId: string;
  workItemId: string | null;
  actor: MemberDto;
  eventType: ActivityEventType;
  summary: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
