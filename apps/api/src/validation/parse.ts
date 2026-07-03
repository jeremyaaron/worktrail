import type { z } from 'zod';

import { ValidationError } from '../errors/app-error.js';

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError('Request validation failed.', result.error.flatten());
  }

  return result.data;
}

