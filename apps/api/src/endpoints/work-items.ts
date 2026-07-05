import type {
  CreateWorkItemRequest,
  CreateWorkItemRelationshipRequest,
  MoveWorkItemOnBoardRequest,
  TransitionWorkItemRequest,
  UpdateWorkItemRequest,
  WorkItemCsvImportApplyDto,
  WorkItemCsvImportApplyRequest,
  WorkItemCsvImportPreviewDto,
  WorkItemCsvImportPreviewRequest,
  WorkspaceWorkItemListItemDto,
  WorkItemDetailDto,
  WorkItemListItemDto,
  WorkItemRelationshipDto,
  WorkItemRelationshipSummaryDto
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import {
  workItemPriorities,
  workItemRelationshipTypes,
  workItemStatuses,
  workItemTypes
} from '../domain/constants.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { WorkItemService } from '../services/work-item-service.js';
import { WorkItemCsvImportService } from '../services/work-item-csv-import-service.js';
import { WorkItemCsvExportService } from '../services/work-item-csv-export-service.js';
import { WorkItemRelationshipService } from '../services/work-item-relationship-service.js';
import { parseWithSchema } from '../validation/parse.js';
import {
  parseProjectWorkItemQuery,
  parseWorkspaceWorkItemQuery
} from '../validation/work-item-query.js';

const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

const workItemIdParamSchema = z.object({
  workItemId: z.string().uuid()
});

const workItemRelationshipIdParamSchema = z.object({
  workItemId: z.string().uuid(),
  relationshipId: z.string().uuid()
});

const nullableUuidSchema = z.string().uuid().nullable();
const nullableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const nullableEstimateSchema = z.number().int().nonnegative().nullable();

const createWorkItemSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: z.enum(workItemTypes),
  status: z.enum(workItemStatuses).optional(),
  priority: z.enum(workItemPriorities),
  assigneeId: nullableUuidSchema.optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  milestoneId: nullableUuidSchema.optional(),
  dueDate: nullableDateSchema.optional(),
  estimatePoints: nullableEstimateSchema.optional()
}) satisfies z.ZodType<CreateWorkItemRequest>;

const csvImportPreviewSchema = z.object({
  csv: z.string()
}) satisfies z.ZodType<WorkItemCsvImportPreviewRequest>;

const csvImportApplySchema = z.object({
  csv: z.string()
}) satisfies z.ZodType<WorkItemCsvImportApplyRequest>;

const updateWorkItemSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    type: z.enum(workItemTypes).optional(),
    priority: z.enum(workItemPriorities).optional(),
    assigneeId: nullableUuidSchema.optional(),
    labelIds: z.array(z.string().uuid()).optional(),
    milestoneId: nullableUuidSchema.optional(),
    dueDate: nullableDateSchema.optional(),
    estimatePoints: nullableEstimateSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one work item field must be provided.'
  }) satisfies z.ZodType<UpdateWorkItemRequest>;

const transitionWorkItemSchema = z.object({
  status: z.enum(workItemStatuses)
}) satisfies z.ZodType<TransitionWorkItemRequest>;

const moveWorkItemOnBoardSchema = z.object({
  status: z.enum(workItemStatuses),
  beforeWorkItemId: nullableUuidSchema.optional(),
  afterWorkItemId: nullableUuidSchema.optional()
}) satisfies z.ZodType<MoveWorkItemOnBoardRequest>;

const createWorkItemRelationshipSchema = z.object({
  relationshipType: z.enum(workItemRelationshipTypes),
  targetWorkItemId: z.string().uuid()
}) satisfies z.ZodType<CreateWorkItemRelationshipRequest>;

export function listWorkItemsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemListItemDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.listWorkItems(projectId, parseProjectWorkItemQuery(request.query))
    };
  };
}

export function listWorkspaceWorkItemsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkspaceWorkItemListItemDto[]> {
  return async (request) => {
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.listWorkspaceWorkItems(parseWorkspaceWorkItemQuery(request.query))
    };
  };
}

export function createWorkItemHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemDetailDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(createWorkItemSchema, request.body);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 201,
      body: await service.createWorkItem(projectId, body)
    };
  };
}

export function previewWorkItemCsvImportHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemCsvImportPreviewDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(csvImportPreviewSchema, request.body);
    const service = new WorkItemCsvImportService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.preview(projectId, body.csv)
    };
  };
}

export function applyWorkItemCsvImportHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemCsvImportApplyDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(csvImportApplySchema, request.body);
    const service = new WorkItemCsvImportService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 201,
      body: await service.apply(projectId, body.csv)
    };
  };
}

export function exportProjectWorkItemsHandler(input: {
  repositories: Repositories;
}): EndpointHandler<string> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectIdParamSchema, request.params);
    const service = new WorkItemCsvExportService({
      actor: request.actor,
      repositories: input.repositories
    });
    const exportResult = await service.exportProjectWorkItems(
      projectId,
      parseProjectWorkItemQuery(request.query)
    );

    return {
      status: 200,
      body: exportResult.csv,
      headers: csvExportHeaders(exportResult.fileName)
    };
  };
}

export function exportWorkspaceWorkItemsHandler(input: {
  repositories: Repositories;
}): EndpointHandler<string> {
  return async (request) => {
    const service = new WorkItemCsvExportService({
      actor: request.actor,
      repositories: input.repositories
    });
    const exportResult = await service.exportWorkspaceWorkItems(parseWorkspaceWorkItemQuery(request.query));

    return {
      status: 200,
      body: exportResult.csv,
      headers: csvExportHeaders(exportResult.fileName)
    };
  };
}

export function getWorkItemHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemDetailDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.getWorkItem(workItemId)
    };
  };
}

export function listWorkItemRelationshipsHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemRelationshipSummaryDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const service = new WorkItemRelationshipService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.getRelationshipSummary(workItemId)
    };
  };
}

export function createWorkItemRelationshipHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemRelationshipDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const body = parseWithSchema(createWorkItemRelationshipSchema, request.body);
    const service = new WorkItemRelationshipService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 201,
      body: await service.createRelationship(workItemId, body)
    };
  };
}

export function deleteWorkItemRelationshipHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<void> {
  return async (request) => {
    const { workItemId, relationshipId } = parseWithSchema(
      workItemRelationshipIdParamSchema,
      request.params
    );
    const service = new WorkItemRelationshipService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    await service.deleteRelationship(workItemId, relationshipId);
    return {
      status: 204
    };
  };
}

function csvExportHeaders(fileName: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`
  };
}

export function updateWorkItemHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemDetailDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const body = parseWithSchema(updateWorkItemSchema, request.body);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.updateWorkItem(workItemId, body)
    };
  };
}

export function transitionWorkItemHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemDetailDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const body = parseWithSchema(transitionWorkItemSchema, request.body);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.transitionWorkItem(workItemId, body)
    };
  };
}

export function moveWorkItemOnBoardHandler(input: {
  repositories: Repositories;
  db?: WorktrailDb;
}): EndpointHandler<WorkItemDetailDto> {
  return async (request) => {
    const { workItemId } = parseWithSchema(workItemIdParamSchema, request.params);
    const body = parseWithSchema(moveWorkItemOnBoardSchema, request.body);
    const service = new WorkItemService({
      actor: request.actor,
      repositories: input.repositories,
      db: input.db
    });
    return {
      status: 200,
      body: await service.moveWorkItemOnBoard(workItemId, body)
    };
  };
}
