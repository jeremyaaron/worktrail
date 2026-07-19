import type { ResolvedWorkItemPageQuery } from '@worktrail/contracts';
import { z } from 'zod';

import { parseWithSchema } from './parse.js';
import { emptyToUndefined, firstQueryValue } from './query-value.js';

const workItemPageSizeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]));

const workItemPageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: workItemPageSizeSchema.default(25)
}) satisfies z.ZodType<ResolvedWorkItemPageQuery>;

export function parseWorkItemPageQuery(
  query: Record<string, string | string[] | undefined>
): ResolvedWorkItemPageQuery {
  return parseWithSchema(workItemPageQuerySchema, {
    page: emptyToUndefined(firstQueryValue(query.page)),
    pageSize: emptyToUndefined(firstQueryValue(query.pageSize))
  });
}
