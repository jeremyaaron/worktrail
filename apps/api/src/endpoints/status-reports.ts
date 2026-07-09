import type {
  CreateProjectStatusReportRequest,
  ProjectStatusReportDetailDto,
  ProjectStatusReportDraftDto,
  ProjectStatusReportSummaryDto
} from '@worktrail/contracts';
import { z } from 'zod';

import type { WorktrailDb } from '../db/client.js';
import type { EndpointHandler } from '../http/app-request.js';
import type { Repositories } from '../repositories/index.js';
import { ProjectStatusReportService } from '../services/project-status-report-service.js';
import { parseWithSchema } from '../validation/parse.js';
import { projectStatusReportSnapshotSchema } from '../validation/project-status-report-snapshot.js';

export interface StatusReportHandlerOptions {
  repositories: Repositories;
  db?: WorktrailDb;
}

const projectParamSchema = z.object({
  projectId: z.string().uuid()
});

const reportParamSchema = z.object({
  projectId: z.string().uuid(),
  reportId: z.string().uuid()
});

const isoDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const narrativeSchema = z.string().trim().max(4000);

const createStatusReportSchema = z.object({
  title: z.string().trim().min(1).max(120),
  statusDate: isoDateSchema,
  summary: narrativeSchema.min(1),
  highlights: narrativeSchema.optional(),
  risks: narrativeSchema.optional(),
  nextSteps: narrativeSchema.optional(),
  snapshot: projectStatusReportSnapshotSchema.optional()
}) satisfies z.ZodType<CreateProjectStatusReportRequest>;

export function listProjectStatusReportsHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportSummaryDto[]> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.listProjectStatusReports(projectId)
    };
  };
}

export function getProjectStatusReportDraftHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDraftDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.getProjectStatusReportDraft(projectId)
    };
  };
}

export function publishProjectStatusReportHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDetailDto> {
  return async (request) => {
    const { projectId } = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(createStatusReportSchema, request.body);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 201,
      body: await service.publishProjectStatusReport(projectId, body)
    };
  };
}

export function getProjectStatusReportHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<ProjectStatusReportDetailDto> {
  return async (request) => {
    const { projectId, reportId } = parseWithSchema(reportParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });

    return {
      status: 200,
      body: await service.getProjectStatusReport(projectId, reportId)
    };
  };
}

export function exportProjectStatusReportMarkdownHandler(
  options: StatusReportHandlerOptions
): EndpointHandler<string> {
  return async (request) => {
    const { projectId, reportId } = parseWithSchema(reportParamSchema, request.params);
    const service = new ProjectStatusReportService({
      actor: request.actor,
      repositories: options.repositories,
      db: options.db
    });
    const exportResult = await service.exportProjectStatusReportMarkdown(projectId, reportId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportResult.fileName}"`
      },
      body: exportResult.markdown
    };
  };
}
