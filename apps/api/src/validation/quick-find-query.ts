import type { QuickFindRequest } from '@worktrail/contracts';
import { z } from 'zod';

import { parseWithSchema } from './parse.js';

export const quickFindQueryMinCodePoints = 2;
export const quickFindQueryMaxCodePoints = 120;

const quickFindQuerySchema = z
  .string()
  .transform(normalizeQuickFindQuery)
  .superRefine((query, context) => {
    const codePointLength = Array.from(query).length;

    if (codePointLength < quickFindQueryMinCodePoints) {
      context.addIssue({
        code: 'custom',
        message: `Query must contain at least ${quickFindQueryMinCodePoints} characters.`
      });
    }

    if (codePointLength > quickFindQueryMaxCodePoints) {
      context.addIssue({
        code: 'custom',
        message: `Query must contain at most ${quickFindQueryMaxCodePoints} characters.`
      });
    }
  });

const quickFindRequestSchema = z.strictObject({
  query: quickFindQuerySchema
}) satisfies z.ZodType<QuickFindRequest>;

export function parseQuickFindRequest(input: unknown): QuickFindRequest {
  return parseWithSchema(quickFindRequestSchema, input);
}

export function normalizeQuickFindQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\p{White_Space}+/gu, ' ');
}
