import type {
  WorkItemCsvImportErrorDto,
  WorkItemCsvImportPreviewDto,
  WorkItemCsvImportPreviewRowDto
} from '@worktrail/contracts';

import type { WorktrailDb } from '../db/client.js';
import type { ActorContext } from '../domain/actor.js';
import {
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
  workItemPriorities,
  workItemStatuses,
  workItemTypes
} from '../domain/constants.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { Label, Member, Milestone, Project } from '../repositories/types.js';
import {
  CsvRecordsParseError,
  type CsvRecord,
  parseCsvRecords
} from './csv/parse-csv-records.js';

const csvImportRequiredHeaders = ['title', 'type', 'priority'] as const;
const csvImportAllowedHeaders = [
  'title',
  'description',
  'type',
  'status',
  'priority',
  'assignee_email',
  'reporter_email',
  'label_names',
  'milestone_name',
  'due_date',
  'estimate_points'
] as const;

const maxCsvBytes = 1024 * 1024;
const maxCsvRows = 250;
const maxLabelsPerRow = 20;
const maxCellLength = 10_000;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export interface WorkItemCsvImportServiceContext {
  actor: ActorContext;
  repositories: Repositories;
  db?: WorktrailDb;
}

interface NormalizedImportRow {
  rowNumber: number;
  title: string;
  description: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeId: string | null;
  assigneeEmail: string | null;
  reporterId: string;
  reporterEmail: string;
  labelIds: string[];
  labelNames: string[];
  milestoneId: string | null;
  milestoneName: string | null;
  dueDate: string | null;
  estimatePoints: number | null;
}

interface ValidationLookups {
  project: Project;
  membersByEmail: Map<string, Member[]>;
  labelsByName: Map<string, Label[]>;
  milestonesByName: Map<string, Milestone[]>;
  actor: Member | null;
}

interface ImportValidationResult {
  totalRows: number;
  errors: WorkItemCsvImportErrorDto[];
  rows: NormalizedImportRow[];
}

export class WorkItemCsvImportService {
  constructor(private readonly context: WorkItemCsvImportServiceContext) {}

  async preview(projectId: string, csv: string): Promise<WorkItemCsvImportPreviewDto> {
    const result = await this.validate(projectId, csv);
    const invalidRowNumbers = new Set(
      result.errors
        .map((error) => error.rowNumber)
        .filter((rowNumber): rowNumber is number => rowNumber !== null && rowNumber > 1)
    );

    return {
      totalRows: result.totalRows,
      validRows: result.rows.length,
      invalidRows: invalidRowNumbers.size,
      errors: result.errors,
      warnings: [],
      rows: result.rows.map((row) => this.toPreviewRow(row))
    };
  }

  private async validate(projectId: string, csv: string): Promise<ImportValidationResult> {
    this.validateHardLimitsBeforeParse(csv);

    const parsed = this.parse(csv);

    if (parsed.errors.length > 0) {
      return {
        totalRows: 0,
        errors: parsed.errors,
        rows: []
      };
    }

    if (parsed.records.length > maxCsvRows) {
      throw new ValidationError(`CSV imports can include at most ${maxCsvRows} data rows.`);
    }

    const lookups = await this.loadLookups(projectId);
    const errors: WorkItemCsvImportErrorDto[] = [];
    const rows: NormalizedImportRow[] = [];

    for (const record of parsed.records) {
      const rowErrors: WorkItemCsvImportErrorDto[] = [];
      const normalized = this.validateRecord(record, lookups, rowErrors);

      errors.push(...rowErrors);

      if (rowErrors.length === 0 && normalized !== null) {
        rows.push(normalized);
      }
    }

    return {
      totalRows: parsed.records.length,
      errors,
      rows
    };
  }

  private validateHardLimitsBeforeParse(csv: string): void {
    if (Buffer.byteLength(csv, 'utf8') > maxCsvBytes) {
      throw new ValidationError('CSV import payload cannot exceed 1 MiB.');
    }
  }

  private parse(csv: string): { records: CsvRecord[]; errors: WorkItemCsvImportErrorDto[] } {
    try {
      const result = parseCsvRecords(csv, {
        requiredHeaders: csvImportRequiredHeaders,
        allowedHeaders: csvImportAllowedHeaders
      });

      return {
        records: result.records,
        errors: []
      };
    } catch (error) {
      if (error instanceof CsvRecordsParseError) {
        return {
          records: [],
          errors: error.issues
        };
      }

      throw error;
    }
  }

  private async loadLookups(projectId: string): Promise<ValidationLookups> {
    const project = await this.context.repositories.projects.findById(projectId);

    if (project === null || project.workspaceId !== this.context.actor.workspaceId) {
      throw new NotFoundError('Project not found.');
    }

    if (project.status === 'archived') {
      throw new ConflictError('Archived projects are read-only.');
    }

    const [members, labels, milestones] = await Promise.all([
      this.context.repositories.members.listByWorkspace(this.context.actor.workspaceId),
      this.context.repositories.labels.listByProject(projectId),
      this.context.repositories.milestones.listByProject(projectId)
    ]);
    const activeMembers = members.filter((member) => member.isActive);

    return {
      project,
      membersByEmail: groupByNormalized(activeMembers, (member) => member.email),
      labelsByName: groupByNormalized(labels, (label) => label.name),
      milestonesByName: groupByNormalized(milestones, (milestone) => milestone.name),
      actor: activeMembers.find((member) => member.id === this.context.actor.memberId) ?? null
    };
  }

  private validateRecord(
    record: CsvRecord,
    lookups: ValidationLookups,
    errors: WorkItemCsvImportErrorDto[]
  ): NormalizedImportRow | null {
    for (const [field, value] of Object.entries(record.values)) {
      if (value.length > maxCellLength) {
        errors.push({
          rowNumber: record.rowNumber,
          field,
          message: `CSV field "${field}" cannot exceed ${maxCellLength} characters.`
        });
      }
    }

    const title = this.requiredString(record, 'title', errors);
    const description = this.optionalString(record, 'description');
    const type = this.enumValue(record, 'type', workItemTypes, errors);
    const status = this.enumValue(record, 'status', workItemStatuses, errors, 'backlog');
    const priority = this.enumValue(record, 'priority', workItemPriorities, errors);
    const assignee = this.optionalMember(record, 'assignee_email', lookups.membersByEmail, errors);
    const reporter = this.reporter(record, lookups, errors);
    const labels = this.labels(record, lookups.labelsByName, errors);
    const milestone = this.optionalNamedLookup(
      record,
      'milestone_name',
      lookups.milestonesByName,
      'Milestone',
      errors
    );
    const dueDate = this.optionalDate(record, errors);
    const estimatePoints = this.optionalEstimate(record, errors);

    if (
      errors.some((error) => error.rowNumber === record.rowNumber) ||
      title === null ||
      type === null ||
      status === null ||
      priority === null ||
      reporter === null ||
      labels === null
    ) {
      return null;
    }

    return {
      rowNumber: record.rowNumber,
      title,
      description,
      type,
      status,
      priority,
      assigneeId: assignee?.id ?? null,
      assigneeEmail: assignee?.email ?? null,
      reporterId: reporter.id,
      reporterEmail: reporter.email,
      labelIds: labels.map((label) => label.id),
      labelNames: labels.map((label) => label.name),
      milestoneId: milestone?.id ?? null,
      milestoneName: milestone?.name ?? null,
      dueDate,
      estimatePoints
    };
  }

  private requiredString(
    record: CsvRecord,
    field: string,
    errors: WorkItemCsvImportErrorDto[]
  ): string | null {
    const value = this.optionalString(record, field);

    if (value.length === 0) {
      errors.push({
        rowNumber: record.rowNumber,
        field,
        message: `CSV field "${field}" is required.`
      });
      return null;
    }

    return value;
  }

  private optionalString(record: CsvRecord, field: string): string {
    return (record.values[field] ?? '').trim();
  }

  private enumValue<T extends string>(
    record: CsvRecord,
    field: string,
    values: readonly T[],
    errors: WorkItemCsvImportErrorDto[],
    defaultValue?: T
  ): T | null {
    const rawValue = this.optionalString(record, field);
    const value = rawValue.length === 0 ? defaultValue : rawValue;

    if (value === undefined) {
      errors.push({
        rowNumber: record.rowNumber,
        field,
        message: `CSV field "${field}" is required.`
      });
      return null;
    }

    if (!values.includes(value as T)) {
      errors.push({
        rowNumber: record.rowNumber,
        field,
        message: `CSV field "${field}" must be one of ${values.join(', ')}.`
      });
      return null;
    }

    return value as T;
  }

  private optionalMember(
    record: CsvRecord,
    field: string,
    membersByEmail: Map<string, Member[]>,
    errors: WorkItemCsvImportErrorDto[]
  ): Member | null {
    const email = this.optionalString(record, field);

    if (email.length === 0) {
      return null;
    }

    return this.lookupOne(record, field, email, membersByEmail, 'Member', errors);
  }

  private reporter(
    record: CsvRecord,
    lookups: ValidationLookups,
    errors: WorkItemCsvImportErrorDto[]
  ): Member | null {
    const email = this.optionalString(record, 'reporter_email');

    if (email.length === 0) {
      if (lookups.actor === null) {
        errors.push({
          rowNumber: record.rowNumber,
          field: 'reporter_email',
          message: 'Reporter email must match an active workspace member.'
        });
      }

      return lookups.actor;
    }

    return this.lookupOne(record, 'reporter_email', email, lookups.membersByEmail, 'Member', errors);
  }

  private labels(
    record: CsvRecord,
    labelsByName: Map<string, Label[]>,
    errors: WorkItemCsvImportErrorDto[]
  ): Label[] | null {
    const rawLabelNames = this.optionalString(record, 'label_names');

    if (rawLabelNames.length === 0) {
      return [];
    }

    const normalizedLabelNames = rawLabelNames
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const uniqueLabelNames: string[] = [];
    const seen = new Set<string>();

    for (const labelName of normalizedLabelNames) {
      const key = normalizeLookupKey(labelName);

      if (!seen.has(key)) {
        seen.add(key);
        uniqueLabelNames.push(labelName);
      }
    }

    if (uniqueLabelNames.length > maxLabelsPerRow) {
      errors.push({
        rowNumber: record.rowNumber,
        field: 'label_names',
        message: `CSV field "label_names" can include at most ${maxLabelsPerRow} labels.`
      });
      return null;
    }

    const labels: Label[] = [];

    for (const labelName of uniqueLabelNames) {
      const label = this.lookupOne(record, 'label_names', labelName, labelsByName, 'Label', errors);

      if (label !== null) {
        labels.push(label);
      }
    }

    return labels;
  }

  private optionalNamedLookup<T>(
    record: CsvRecord,
    field: string,
    lookups: Map<string, T[]>,
    resourceName: string,
    errors: WorkItemCsvImportErrorDto[]
  ): T | null {
    const name = this.optionalString(record, field);

    if (name.length === 0) {
      return null;
    }

    return this.lookupOne(record, field, name, lookups, resourceName, errors);
  }

  private lookupOne<T>(
    record: CsvRecord,
    field: string,
    value: string,
    lookups: Map<string, T[]>,
    resourceName: string,
    errors: WorkItemCsvImportErrorDto[]
  ): T | null {
    const matches = lookups.get(normalizeLookupKey(value)) ?? [];

    if (matches.length === 0) {
      errors.push({
        rowNumber: record.rowNumber,
        field,
        message: `${resourceName} "${value}" was not found.`
      });
      return null;
    }

    if (matches.length > 1) {
      errors.push({
        rowNumber: record.rowNumber,
        field,
        message: `${resourceName} "${value}" is ambiguous.`
      });
      return null;
    }

    return matches[0] ?? null;
  }

  private optionalDate(record: CsvRecord, errors: WorkItemCsvImportErrorDto[]): string | null {
    const value = this.optionalString(record, 'due_date');

    if (value.length === 0) {
      return null;
    }

    if (!dateOnlyPattern.test(value) || !isValidDateOnly(value)) {
      errors.push({
        rowNumber: record.rowNumber,
        field: 'due_date',
        message: 'CSV field "due_date" must be a valid YYYY-MM-DD date.'
      });
      return null;
    }

    return value;
  }

  private optionalEstimate(record: CsvRecord, errors: WorkItemCsvImportErrorDto[]): number | null {
    const value = this.optionalString(record, 'estimate_points');

    if (value.length === 0) {
      return null;
    }

    if (!/^\d+$/.test(value)) {
      errors.push({
        rowNumber: record.rowNumber,
        field: 'estimate_points',
        message: 'CSV field "estimate_points" must be a non-negative integer.'
      });
      return null;
    }

    return Number.parseInt(value, 10);
  }

  private toPreviewRow(row: NormalizedImportRow): WorkItemCsvImportPreviewRowDto {
    return {
      rowNumber: row.rowNumber,
      title: row.title,
      type: row.type,
      status: row.status,
      priority: row.priority,
      assigneeEmail: row.assigneeEmail,
      reporterEmail: row.reporterEmail,
      labelNames: row.labelNames,
      milestoneName: row.milestoneName,
      dueDate: row.dueDate,
      estimatePoints: row.estimatePoints
    };
  }
}

function groupByNormalized<T>(items: T[], getValue: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = normalizeLookupKey(getValue(item));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function isValidDateOnly(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
