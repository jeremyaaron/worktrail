import type { QuickFindResultDto } from '@worktrail/contracts';

import type { RouterLinkQueryParams } from '../work-items/query/work-item-query-serialization';

export interface QuickFindRouteTarget {
  commands: readonly string[];
  queryParams?: RouterLinkQueryParams;
  fragment?: string;
}

export interface QuickFindNavigationEntry extends QuickFindRouteTarget {
  id: string;
  label: string;
  detail?: string;
}

export type QuickFindSelectableOption =
  | { type: 'navigation'; entry: QuickFindNavigationEntry }
  | { type: 'result'; result: QuickFindResultDto }
  | { type: 'work_item_overflow'; query: string };
