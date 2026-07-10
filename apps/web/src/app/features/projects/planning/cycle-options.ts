import type { ProjectCycleDto } from '@worktrail/contracts';

import { cycleDateRangeLabel, cycleStatusLabel } from '../../../shared/cycles/cycle-display';

export interface CycleOption {
  id: string;
  label: string;
  statusLabel: string;
  dateRangeLabel: string;
  isArchived: boolean;
}

export function cycleOptionFromDto(cycle: ProjectCycleDto): CycleOption {
  return {
    id: cycle.id,
    label: cycle.name,
    statusLabel: cycleStatusLabel(cycle.status),
    dateRangeLabel: cycleDateRangeLabel(cycle),
    isArchived: cycle.isArchived
  };
}

export function cycleOptionsFromDtos(cycles: readonly ProjectCycleDto[]): CycleOption[] {
  return [...cycles]
    .sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }

      return left.name.localeCompare(right.name);
    })
    .map(cycleOptionFromDto);
}
