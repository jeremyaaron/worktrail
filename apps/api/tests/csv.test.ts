import { describe, expect, it } from 'vitest';

import {
  CsvRecordsParseError,
  parseCsvRecords
} from '../src/services/csv/parse-csv-records.js';
import { stringifyCsvRecords } from '../src/services/csv/stringify-csv-records.js';

const requiredHeaders = ['title', 'type'] as const;
const allowedHeaders = ['title', 'type', 'label_names'] as const;

describe('CSV service utilities', () => {
  it('parses quoted commas, skips empty lines, and preserves physical row numbers', () => {
    const result = parseCsvRecords('title,type,label_names\n\n"Fix board, layout",bug,"frontend,ux"\n', {
      requiredHeaders,
      allowedHeaders
    });

    expect(result.headers).toEqual(['title', 'type', 'label_names']);
    expect(result.records).toEqual([
      {
        rowNumber: 3,
        values: {
          title: 'Fix board, layout',
          type: 'bug',
          label_names: 'frontend,ux'
        }
      }
    ]);
  });

  it('reports missing required headers', () => {
    expect(() =>
      parseCsvRecords('title,label_names\nExample,backend\n', {
        requiredHeaders,
        allowedHeaders
      })
    ).toThrow(CsvRecordsParseError);

    try {
      parseCsvRecords('title,label_names\nExample,backend\n', {
        requiredHeaders,
        allowedHeaders
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CsvRecordsParseError);
      expect((error as CsvRecordsParseError).issues).toEqual([
        {
          rowNumber: 1,
          field: 'type',
          message: 'CSV header "type" is required.'
        }
      ]);
    }
  });

  it('reports unknown and duplicate headers', () => {
    try {
      parseCsvRecords('title,type,type,external_id\nExample,task,bug,ABC-1\n', {
        requiredHeaders,
        allowedHeaders
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CsvRecordsParseError);
      expect((error as CsvRecordsParseError).issues).toEqual([
        {
          rowNumber: 1,
          field: 'type',
          message: 'CSV header "type" is duplicated.'
        },
        {
          rowNumber: 1,
          field: 'external_id',
          message: 'CSV header "external_id" is not supported.'
        }
      ]);
    }
  });

  it('converts parser failures to safe errors', () => {
    try {
      parseCsvRecords('title,type\n"unterminated,task\n', {
        requiredHeaders,
        allowedHeaders
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CsvRecordsParseError);
      expect((error as CsvRecordsParseError).issues).toEqual([
        {
          rowNumber: null,
          field: null,
          message: 'CSV could not be parsed.'
        }
      ]);
    }
  });

  it('stringifies records with stable headers and escaped values', () => {
    const csv = stringifyCsvRecords(
      [
        {
          title: 'Fix board, layout',
          labelNames: 'frontend,ux',
          priority: 'high'
        }
      ],
      [
        { key: 'title', header: 'title' },
        { key: 'priority', header: 'priority' },
        { key: 'labelNames', header: 'label_names' }
      ]
    );

    expect(csv).toBe('title,priority,label_names\n"Fix board, layout",high,"frontend,ux"\n');
  });

  it('stringifies empty result sets with a header row', () => {
    const csv = stringifyCsvRecords([], [
      { key: 'title', header: 'title' },
      { key: 'priority', header: 'priority' }
    ]);

    expect(csv).toBe('title,priority\n');
  });
});
