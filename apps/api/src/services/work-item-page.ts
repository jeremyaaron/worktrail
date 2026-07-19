import type {
  ResolvedWorkItemPageQuery,
  WorkItemPageMetadataDto
} from '@worktrail/contracts';

export interface WorkItemPageResolution {
  metadata: WorkItemPageMetadataDto;
  offset: number;
}

export function resolveWorkItemPage(
  requested: ResolvedWorkItemPageQuery,
  totalCount: number
): WorkItemPageResolution {
  if (!Number.isSafeInteger(totalCount) || totalCount < 0) {
    throw new RangeError('Work item page total count must be a nonnegative safe integer.');
  }

  const totalPages = Math.ceil(totalCount / requested.pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requested.page, totalPages);
  const offset = (page - 1) * requested.pageSize;

  if (!Number.isSafeInteger(offset)) {
    throw new RangeError('Work item page offset exceeds the safe integer range.');
  }

  return {
    metadata: {
      page,
      pageSize: requested.pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: totalPages > 0 && page > 1,
      hasNextPage: totalPages > 0 && page < totalPages
    },
    offset
  };
}
