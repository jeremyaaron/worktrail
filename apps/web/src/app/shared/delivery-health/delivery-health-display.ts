import type {
  DeliveryHealthReasonDto,
  DeliveryHealthSeverity,
  DeliveryHealthState,
  WorkItemQuery
} from '@worktrail/contracts';

import {
  routerLinkQueryParamsFromWorkItemQuery,
  type WorkItemQueryScope
} from '../../features/work-items/query/work-item-query-serialization';

export type DeliveryHealthTone = 'positive' | 'warning' | 'critical' | 'neutral' | 'info';

const healthLabels: Record<DeliveryHealthState, string> = {
  healthy: 'On track',
  at_risk: 'At risk',
  blocked: 'Blocked',
  complete: 'Complete',
  inactive: 'Inactive'
};

const healthTones: Record<DeliveryHealthState, DeliveryHealthTone> = {
  healthy: 'positive',
  at_risk: 'warning',
  blocked: 'critical',
  complete: 'info',
  inactive: 'neutral'
};

const severityLabels: Record<DeliveryHealthSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical'
};

const severityTones: Record<DeliveryHealthSeverity, DeliveryHealthTone> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical'
};

export function deliveryHealthLabel(state: DeliveryHealthState): string {
  return healthLabels[state];
}

export function deliveryHealthTone(state: DeliveryHealthState): DeliveryHealthTone {
  return healthTones[state];
}

export function deliveryHealthSeverityLabel(severity: DeliveryHealthSeverity): string {
  return severityLabels[severity];
}

export function deliveryHealthSeverityTone(severity: DeliveryHealthSeverity): DeliveryHealthTone {
  return severityTones[severity];
}

export function deliveryHealthReasonLabel(reason: DeliveryHealthReasonDto): string {
  return reason.message;
}

export function deliveryHealthReasonQueryParams(
  reason: DeliveryHealthReasonDto,
  scope: WorkItemQueryScope = 'project'
): Record<string, string> | null {
  return workItemQueryToRouterQueryParams(reason.query, scope);
}

export function workItemQueryToRouterQueryParams(
  query: WorkItemQuery | null,
  scope: WorkItemQueryScope = 'project'
): Record<string, string> | null {
  return routerLinkQueryParamsFromWorkItemQuery(query, scope);
}
