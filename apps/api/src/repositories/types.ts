import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type {
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
} from '../db/schema.js';

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;
export type Member = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;
export type Milestone = InferSelectModel<typeof milestones>;
export type NewMilestone = InferInsertModel<typeof milestones>;
export type SavedWorkView = InferSelectModel<typeof savedWorkViews>;
export type NewSavedWorkView = InferInsertModel<typeof savedWorkViews>;
export type WorkItem = InferSelectModel<typeof workItems>;
export type NewWorkItem = InferInsertModel<typeof workItems>;
export type Label = InferSelectModel<typeof labels>;
export type NewLabel = InferInsertModel<typeof labels>;
export type WorkItemLabel = InferSelectModel<typeof workItemLabels>;
export type Comment = InferSelectModel<typeof comments>;
export type NewComment = InferInsertModel<typeof comments>;
export type ActivityEvent = InferSelectModel<typeof activityEvents>;
export type NewActivityEvent = InferInsertModel<typeof activityEvents>;
export type WorkspaceActivityEvent = InferSelectModel<typeof workspaceActivityEvents>;
export type NewWorkspaceActivityEvent = InferInsertModel<typeof workspaceActivityEvents>;
