import type { ProjectCycleStatus } from './cycles.js';
import type { DeliveryHealthState } from './health.js';
import type { MilestoneStatus } from './planning.js';
import type { ProjectStatus } from './projects.js';
import type { WorkItemStatus, WorkItemType } from './work-items.js';

export interface QuickFindRequest {
  query: string;
}

export type QuickFindMatchMode = 'exact' | 'prefix' | 'substring';

export type QuickFindMatchField =
  | 'project_key'
  | 'project_name'
  | 'project_description'
  | 'work_item_key'
  | 'work_item_title'
  | 'work_item_description'
  | 'milestone_name'
  | 'milestone_description'
  | 'cycle_name'
  | 'report_title'
  | 'report_summary'
  | 'attachment_file_name';

export interface QuickFindMatchDto {
  field: QuickFindMatchField;
  mode: QuickFindMatchMode;
  excerpt: string | null;
}

export interface QuickFindProjectContextDto {
  id: string;
  key: string;
  name: string;
  status: ProjectStatus;
}

export interface QuickFindWorkItemContextDto {
  id: string;
  displayKey: string;
  title: string;
  status: WorkItemStatus;
  type: WorkItemType;
}

export interface QuickFindProjectResultDto {
  kind: 'project';
  project: QuickFindProjectContextDto;
  match: QuickFindMatchDto;
}

export interface QuickFindWorkItemResultDto {
  kind: 'work_item';
  project: QuickFindProjectContextDto;
  workItem: QuickFindWorkItemContextDto;
  match: QuickFindMatchDto;
}

export interface QuickFindMilestoneResultDto {
  kind: 'milestone';
  project: QuickFindProjectContextDto;
  milestone: {
    id: string;
    name: string;
    status: MilestoneStatus;
    targetDate: string | null;
    isArchived: boolean;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindCycleResultDto {
  kind: 'cycle';
  project: QuickFindProjectContextDto;
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

export interface QuickFindReportResultDto {
  kind: 'report';
  project: QuickFindProjectContextDto;
  report: {
    id: string;
    title: string;
    statusDate: string;
    health: DeliveryHealthState;
    publishedAt: string;
  };
  match: QuickFindMatchDto;
}

export interface QuickFindAttachmentResultDto {
  kind: 'attachment';
  project: QuickFindProjectContextDto;
  workItem: QuickFindWorkItemContextDto;
  attachment: {
    id: string;
    fileName: string;
    byteSize: number;
    createdAt: string;
  };
  match: QuickFindMatchDto;
}

export type QuickFindResultDto =
  | QuickFindWorkItemResultDto
  | QuickFindProjectResultDto
  | QuickFindMilestoneResultDto
  | QuickFindCycleResultDto
  | QuickFindReportResultDto
  | QuickFindAttachmentResultDto;

export interface QuickFindGroupDto<TItem> {
  items: TItem[];
  hasMore: boolean;
}

export interface QuickFindResponseDto {
  query: string;
  groups: {
    workItems: QuickFindGroupDto<QuickFindWorkItemResultDto>;
    projects: QuickFindGroupDto<QuickFindProjectResultDto>;
    milestones: QuickFindGroupDto<QuickFindMilestoneResultDto>;
    cycles: QuickFindGroupDto<QuickFindCycleResultDto>;
    reports: QuickFindGroupDto<QuickFindReportResultDto>;
    attachments: QuickFindGroupDto<QuickFindAttachmentResultDto>;
  };
}
