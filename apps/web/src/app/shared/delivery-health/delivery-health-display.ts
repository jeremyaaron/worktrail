import type {
  DeliveryHealthReasonDto,
  DeliveryHealthSeverity,
  DeliveryHealthState,
  WorkItemQuery
} from '@worktrail/contracts';

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
  reason: DeliveryHealthReasonDto
): Record<string, string> | null {
  return workItemQueryToRouterQueryParams(reason.query);
}

export function workItemQueryToRouterQueryParams(
  query: WorkItemQuery | null
): Record<string, string> | null {
  if (query === null) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params[key] = String(value);
    }
  }

  return Object.keys(params).length === 0 ? null : params;
}
