import { parse } from 'csv-parse/sync';

export interface CsvRecord {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CsvParseIssue {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface ParseCsvRecordsOptions {
  requiredHeaders: readonly string[];
  allowedHeaders: readonly string[];
}

export interface ParseCsvRecordsResult {
  headers: string[];
  records: CsvRecord[];
}

export class CsvRecordsParseError extends Error {
  readonly issues: CsvParseIssue[];

  constructor(issues: CsvParseIssue[]) {
    super('CSV validation failed.');
    this.name = 'CsvRecordsParseError';
    this.issues = issues;
  }
}

interface ParsedRecord {
  record: Record<string, string | undefined>;
  info: {
    lines: number;
  };
}

export function parseCsvRecords(
  csv: string,
  options: ParseCsvRecordsOptions
): ParseCsvRecordsResult {
  const requiredHeaders = new Set(options.requiredHeaders);
  const allowedHeaders = new Set(options.allowedHeaders);
  let headers: string[] = [];
  let parsedRecords: ParsedRecord[];

  try {
    parsedRecords = parse(csv, {
      bom: true,
      columns: (parsedHeaders: string[]) => {
        headers = parsedHeaders.map((header) => header.trim());
        return headers;
      },
      info: true,
      skip_empty_lines: true,
      trim: true
    }) as ParsedRecord[];
  } catch {
    throw new CsvRecordsParseError([
      {
        rowNumber: null,
        field: null,
        message: 'CSV could not be parsed.'
      }
    ]);
  }

  const headerIssues = validateHeaders(headers, requiredHeaders, allowedHeaders);

  if (headerIssues.length > 0) {
    throw new CsvRecordsParseError(headerIssues);
  }

  const records = parsedRecords.map(({ record, info }) => ({
    rowNumber: info.lines,
    values: normalizeRecord(record, headers)
  }));

  return { headers, records };
}

function validateHeaders(
  headers: string[],
  requiredHeaders: ReadonlySet<string>,
  allowedHeaders: ReadonlySet<string>
): CsvParseIssue[] {
  const issues: CsvParseIssue[] = [];

  if (headers.length === 0) {
    return [
      {
        rowNumber: null,
        field: null,
        message: 'CSV must include a header row.'
      }
    ];
  }

  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (header.length === 0) {
      issues.push({
        rowNumber: 1,
        field: null,
        message: 'CSV headers cannot be empty.'
      });
      continue;
    }

    if (seenHeaders.has(header)) {
      issues.push({
        rowNumber: 1,
        field: header,
        message: `CSV header "${header}" is duplicated.`
      });
    }

    seenHeaders.add(header);

    if (!allowedHeaders.has(header)) {
      issues.push({
        rowNumber: 1,
        field: header,
        message: `CSV header "${header}" is not supported.`
      });
    }
  }

  for (const requiredHeader of requiredHeaders) {
    if (!seenHeaders.has(requiredHeader)) {
      issues.push({
        rowNumber: 1,
        field: requiredHeader,
        message: `CSV header "${requiredHeader}" is required.`
      });
    }
  }

  return issues;
}

function normalizeRecord(record: Record<string, string | undefined>, headers: string[]) {
  const normalized: Record<string, string> = {};

  for (const header of headers) {
    normalized[header] = record[header] ?? '';
  }

  return normalized;
}
