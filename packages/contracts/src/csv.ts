import type { WorkItemListItemDto, WorkItemPriority, WorkItemStatus, WorkItemType } from './work-items.js';

export interface WorkItemCsvImportPreviewRequest {
  csv: string;
}

export interface WorkItemCsvImportApplyRequest {
  csv: string;
}

export interface WorkItemCsvImportErrorDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportWarningDto {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface WorkItemCsvImportPreviewRowDto {
  rowNumber: number;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeEmail: string | null;
  reporterEmail: string;
  labelNames: string[];
  milestoneName: string | null;
  dueDate: string | null;
  estimatePoints: number | null;
}

export interface WorkItemCsvImportPreviewDto {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: WorkItemCsvImportErrorDto[];
  warnings: WorkItemCsvImportWarningDto[];
  rows: WorkItemCsvImportPreviewRowDto[];
}

export interface WorkItemCsvImportApplyDto {
  createdCount: number;
  workItems: WorkItemListItemDto[];
}
