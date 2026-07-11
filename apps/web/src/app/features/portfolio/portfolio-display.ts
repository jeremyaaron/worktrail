import type {
  DeliveryHealthSeverity,
  DeliveryHealthState,
  PortfolioLinkDto,
  PortfolioReportFreshness
} from '@worktrail/contracts';

import {
  routerLinkQueryParamsFromWorkItemQuery,
  type WorkItemQueryScope
} from '../work-items/query/work-item-query-serialization';

export type Tone = 'positive' | 'warning' | 'critical' | 'neutral' | 'info';

const healthLabels: Record<DeliveryHealthState, string> = {
  healthy: 'On track',
  at_risk: 'At risk',
  blocked: 'Blocked',
  complete: 'Complete',
  inactive: 'Inactive'
};

const healthTones: Record<DeliveryHealthState, Tone> = {
  healthy: 'positive',
  at_risk: 'warning',
  blocked: 'critical',
  complete: 'info',
  inactive: 'neutral'
};

const severityTones: Record<DeliveryHealthSeverity, Tone> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical'
};

export function healthLabel(value: DeliveryHealthState): string {
  return healthLabels[value];
}

export function healthTone(value: DeliveryHealthState): Tone {
  return healthTones[value];
}

export function severityTone(value: DeliveryHealthSeverity): Tone {
  return severityTones[value];
}

export function reportFreshnessLabel(value: PortfolioReportFreshness): string {
  if (value === 'missing') {
    return 'Report missing';
  }

  return value === 'stale' ? 'Report stale' : 'Report fresh';
}

export function reportFreshnessTone(value: PortfolioReportFreshness): Tone {
  if (value === 'fresh') {
    return 'positive';
  }

  return value === 'stale' ? 'warning' : 'neutral';
}

export function formatDate(value: string | null): string {
  if (value === null) {
    return 'No date';
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function portfolioLinkQueryParams(link: PortfolioLinkDto): Record<string, string> | null {
  if (link.query === undefined) {
    return null;
  }

  return routerLinkQueryParamsFromWorkItemQuery(
    link.query,
    link.queryScope ?? ('project' satisfies WorkItemQueryScope)
  );
}
