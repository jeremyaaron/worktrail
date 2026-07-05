import { stringify } from 'csv-stringify/sync';

export interface CsvStringifyColumn {
  key: string;
  header: string;
}

export type CsvStringifyRecord = Record<string, string | number | boolean | null | undefined>;

export function stringifyCsvRecords(
  records: CsvStringifyRecord[],
  columns: readonly CsvStringifyColumn[]
): string {
  return stringify(records, {
    columns: columns.map((column) => ({
      key: column.key,
      header: column.header
    })),
    header: true
  });
}
