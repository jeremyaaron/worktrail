import type { WorkItemQuery, WorkspaceWorkItemListItemDto, WorkItemListItemDto } from '@worktrail/contracts';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import { ExportLimitExceededError, NotFoundError } from '../errors/app-error.js';
import {
  type Repositories,
  withRepositoriesReadTransaction
} from '../repositories/index.js';
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
  { key: 'cycleName', header: 'cycle_name' },
  { key: 'dueDate', header: 'due_date' },
  { key: 'estimatePoints', header: 'estimate_points' },
  { key: 'createdAt', header: 'created_at' },
  { key: 'updatedAt', header: 'updated_at' },
  { key: 'parentKey', header: 'parent_key' },
  { key: 'parentTitle', header: 'parent_title' }
] as const;

export interface WorkItemCsvExportResult {
  csv: string;
  fileName: string;
}

export interface WorkItemCsvExportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
}

export const synchronousExportLimit = 10_000;
const synchronousExportReadLimit = synchronousExportLimit + 1;

export class WorkItemCsvExportService {
  constructor(private readonly context: WorkItemCsvExportServiceContext) {}

  async exportProjectWorkItems(
    projectId: string,
    filters: WorkItemListFilters = {}
  ): Promise<WorkItemCsvExportResult> {
    const exportData = await this.withReadRepositories(async (repositories) => {
      const project = await repositories.projects.findById(projectId);

      if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
        throw new NotFoundError('Project not found.');
      }

      const rawWorkItems = await repositories.workItems.listByProjectForExport(
        projectId,
        filters,
        synchronousExportReadLimit
      );
      this.assertWithinExportLimit(rawWorkItems.length);
      const service = new WorkItemService({
        actor: this.context.actor,
        repositories
      });

      return {
        projectKey: project.key,
        workItems: await service.enrichWorkItemListWithRepositories(rawWorkItems, repositories)
      };
    });

    return {
      csv: stringifyCsvRecords(
        exportData.workItems.map((item) => toExportRow(exportData.projectKey, item)),
        exportColumns
      ),
      fileName: `worktrail-${exportData.projectKey.toLowerCase()}-work-items.csv`
    };
  }

  async exportWorkspaceWorkItems(filters: WorkItemQuery = {}): Promise<WorkItemCsvExportResult> {
    const workItems = await this.withReadRepositories(async (repositories) => {
      const records = await repositories.workItems.listByWorkspaceForExport(
        this.context.actor.workspaceId,
        filters,
        synchronousExportReadLimit
      );
      this.assertWithinExportLimit(records.length);
      const service = new WorkItemService({
        actor: this.context.actor,
        repositories
      });

      return service.enrichWorkspaceWorkItemListWithRepositories(records, repositories);
    });

    return {
      csv: stringifyCsvRecords(
        workItems.map((item) => toExportRow(item.project.key, item)),
        exportColumns
      ),
      fileName: 'worktrail-work-items.csv'
    };
  }

  private assertWithinExportLimit(rowCount: number): void {
    if (rowCount > synchronousExportLimit) {
      throw new ExportLimitExceededError(synchronousExportLimit);
    }
  }

  private async withReadRepositories<T>(
    callback: (repositories: Repositories) => Promise<T>
  ): Promise<T> {
    if (this.context.db === undefined) {
      return callback(this.context.repositories);
    }

    return withRepositoriesReadTransaction(this.context.db, callback);
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
    cycleName: item.cycle?.name ?? '',
    dueDate: item.dueDate ?? '',
    estimatePoints: item.estimatePoints ?? '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    parentKey: item.parent?.displayKey ?? '',
    parentTitle: item.parent?.title ?? ''
  };
}
