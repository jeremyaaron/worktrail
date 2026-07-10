import type { DeliveryHealthState, ProjectCycleDto, ProjectCycleStatus } from '@worktrail/contracts';

import { deliveryHealthLabel } from '../delivery-health/delivery-health-display';

const cycleStatusLabels: Record<ProjectCycleStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  canceled: 'Canceled'
};

export function cycleStatusLabel(status: ProjectCycleStatus): string {
  return cycleStatusLabels[status];
}

export function cycleDateRangeLabel(cycle: Pick<ProjectCycleDto, 'startDate' | 'endDate'>): string {
  return `${formatCycleDate(cycle.startDate)} - ${formatCycleDate(cycle.endDate)}`;
}

export function cycleHealthLabel(health: DeliveryHealthState): string {
  return deliveryHealthLabel(health);
}

export function formatCycleDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}
