import type { WorkItemQuery, WorkspaceWorkItemListItemDto, WorkItemListItemDto } from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import { NotFoundError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import { stringifyCsvRecords, type CsvStringifyRecord } from './csv/stringify-csv-records.js';
import { type WorkItemListFilters, WorkItemService } from './work-item-service.js';

const exportColumns = [
  { key: 'projectKey', header: 'project_key' },
  { key: 'displayKey', header: 'display_key' },
  { key: 'title', header: 'title' },
  { key: 'type', header: 'type' },
  { key: 'status', header: 'status' },
  { key: 'priority', header: 'priority' },
  { key: 'assigneeName', header: 'assignee_name' },
  { key: 'assigneeEmail', header: 'assignee_email' },
  { key: 'reporterName', header: 'reporter_name' },
  { key: 'reporterEmail', header: 'reporter_email' },
  { key: 'labelNames', header: 'label_names' },
  { key: 'milestoneName', header: 'milestone_name' },
  { key: 'dueDate', header: 'due_date' },
  { key: 'estimatePoints', header: 'estimate_points' },
  { key: 'createdAt', header: 'created_at' },
  { key: 'updatedAt', header: 'updated_at' }
] as const;

export interface WorkItemCsvExportResult {
  csv: string;
  fileName: string;
}

export interface WorkItemCsvExportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
}

export class WorkItemCsvExportService {
  constructor(private readonly context: WorkItemCsvExportServiceContext) {}

  async exportProjectWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Promise<WorkItemCsvExportResult> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    const service = new WorkItemService({
      actor: this.context.actor,
      repositories: this.context.repositories
    });
    const workItems = await service.listWorkItems(projectId, filters);

    return {
      csv: stringifyCsvRecords(
        workItems.map((item) => toExportRow(project.key, item)),
        exportColumns
      ),
      fileName: `worktrail-${project.key.toLowerCase()}-work-items.csv`
    };
  }

  async exportWorkspaceWorkItems(filters: WorkItemQuery = {}): Promise<WorkItemCsvExportResult> {
    const service = new WorkItemService({
      actor: this.context.actor,
      repositories: this.context.repositories
    });
    const workItems = await service.listWorkspaceWorkItems(filters);

    return {
      csv: stringifyCsvRecords(
        workItems.map((item) => toExportRow(item.project.key, item)),
        exportColumns
      ),
      fileName: 'worktrail-work-items.csv'
    };
  }
}

function toExportRow(
  projectKey: string,
  item: WorkItemListItemDto | WorkspaceWorkItemListItemDto
): CsvStringifyRecord {
  return {
    projectKey,
    displayKey: item.displayKey,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    assigneeName: item.assignee?.name ?? '',
    assigneeEmail: item.assignee?.email ?? '',
    reporterName: item.reporter.name,
    reporterEmail: item.reporter.email,
    labelNames: item.labels.map((label) => label.name).join(','),
    milestoneName: item.milestone?.name ?? '',
    dueDate: item.dueDate ?? '',
    estimatePoints: item.estimatePoints ?? '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}
