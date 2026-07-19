import { describe, expect, expectTypeOf, it } from 'vitest';

import { workItemPageSizes } from './work-items.js';
import type {
  CreateSavedWorkViewRequest,
  ProjectCycleCloseoutItemSnapshotDto,
  ProjectCycleCloseoutSnapshotDto,
  ProjectStatusReportSnapshotDto,
  ResolvedWorkItemPageQuery,
  SavedWorkViewDto,
  UpdateSavedWorkViewRequest,
  WorkItemListItemDto,
  WorkItemListPageDto,
  WorkItemPageMetadataDto,
  WorkItemPageQuery,
  WorkItemPageSize,
  WorkItemQuery,
  WorkspaceWorkItemListItemDto,
  WorkspaceWorkItemListPageDto
} from './index.js';

describe('work item page contracts', () => {
  it('defines the supported page sizes', () => {
    expect(workItemPageSizes).toEqual([10, 25, 50, 100]);
    expectTypeOf<(typeof workItemPageSizes)[number]>().toEqualTypeOf<WorkItemPageSize>();
  });

  it('separates optional page input from resolved page state', () => {
    const optionalQuery = {} satisfies WorkItemPageQuery;
    const resolvedQuery = {
      page: 2,
      pageSize: 50
    } satisfies ResolvedWorkItemPageQuery;

    expect(optionalQuery).toEqual({});
    expect(resolvedQuery).toEqual({ page: 2, pageSize: 50 });
    expectTypeOf<WorkItemPageQuery['page']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ResolvedWorkItemPageQuery['page']>().toEqualTypeOf<number>();
  });

  it('uses concrete project and workspace item collections', () => {
    expectTypeOf<WorkItemListPageDto['items']>().toEqualTypeOf<WorkItemListItemDto[]>();
    expectTypeOf<WorkspaceWorkItemListPageDto['items']>().toEqualTypeOf<
      WorkspaceWorkItemListItemDto[]
    >();
  });

  it('represents empty page metadata exactly', () => {
    const page = {
      items: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false
    } satisfies WorkItemListPageDto;

    expect(page).toEqual({
      items: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false
    });
  });

  it('defines concrete page metadata fields', () => {
    expectTypeOf<WorkItemPageMetadataDto>().toMatchTypeOf<{
      page: number;
      pageSize: WorkItemPageSize;
      totalCount: number;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    }>();
  });

  it('keeps paging state out of durable work item and saved-view queries', () => {
    expectTypeOf<'page' extends keyof WorkItemQuery ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'pageSize' extends keyof WorkItemQuery ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<SavedWorkViewDto['query']>().toEqualTypeOf<WorkItemQuery>();
    expectTypeOf<CreateSavedWorkViewRequest['query']>().toEqualTypeOf<WorkItemQuery>();
    expectTypeOf<UpdateSavedWorkViewRequest['query']>().toEqualTypeOf<
      WorkItemQuery | undefined
    >();
  });

  it('keeps page metadata out of immutable report and closeout snapshots', () => {
    type PageMetadataField = keyof WorkItemPageMetadataDto;

    expectTypeOf<
      Extract<PageMetadataField, keyof ProjectStatusReportSnapshotDto>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<PageMetadataField, keyof ProjectStatusReportSnapshotDto['recentWork'][number]>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<PageMetadataField, keyof ProjectCycleCloseoutSnapshotDto>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<PageMetadataField, keyof ProjectCycleCloseoutItemSnapshotDto>
    >().toEqualTypeOf<never>();
  });
});
