import {
  workItemPageSizes,
  type ResolvedWorkItemPageQuery,
  type WorkItemPageSize
} from '@worktrail/contracts';

import type {
  QueryParamReader,
  RouterQueryParams
} from './work-item-query-serialization';

export const defaultWorkItemPageQuery = {
  page: 1,
  pageSize: 25
} as const satisfies ResolvedWorkItemPageQuery;

export function workItemPageQueryFromParams(
  params: QueryParamReader
): ResolvedWorkItemPageQuery {
  return {
    page: parsePage(params.get('page')),
    pageSize: parsePageSize(params.get('pageSize'))
  };
}

export function isCanonicalWorkItemPageQuery(params: QueryParamReader): boolean {
  const canonical = routerQueryParamsFromWorkItemPage(workItemPageQueryFromParams(params));

  return (
    params.get('page') === canonical['page'] &&
    params.get('pageSize') === canonical['pageSize']
  );
}

export function routerQueryParamsFromWorkItemPage(
  pageQuery: ResolvedWorkItemPageQuery
): RouterQueryParams {
  return {
    page: pageQuery.page === defaultWorkItemPageQuery.page ? null : String(pageQuery.page),
    pageSize:
      pageQuery.pageSize === defaultWorkItemPageQuery.pageSize
        ? null
        : String(pageQuery.pageSize)
  };
}

export function mergeWorkItemRouteParams(
  queryParams: RouterQueryParams,
  pageQuery: ResolvedWorkItemPageQuery
): RouterQueryParams {
  return {
    ...queryParams,
    ...routerQueryParamsFromWorkItemPage(pageQuery)
  };
}

export function workItemPageQueryForPage(
  current: ResolvedWorkItemPageQuery,
  page: number
): ResolvedWorkItemPageQuery {
  return {
    page: isPositiveInteger(page) ? page : defaultWorkItemPageQuery.page,
    pageSize: current.pageSize
  };
}

export function workItemPageQueryForPageSize(
  pageSize: WorkItemPageSize
): ResolvedWorkItemPageQuery {
  return {
    page: defaultWorkItemPageQuery.page,
    pageSize
  };
}

function parsePage(value: string | null): number {
  if (value === null || !/^[1-9]\d*$/.test(value)) {
    return defaultWorkItemPageQuery.page;
  }

  const page = Number(value);
  return isPositiveInteger(page) ? page : defaultWorkItemPageQuery.page;
}

function parsePageSize(value: string | null): WorkItemPageSize {
  const pageSize = workItemPageSizes.find((candidate) => String(candidate) === value);

  return pageSize ?? defaultWorkItemPageQuery.pageSize;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
