import type { DeliveryHealthSeverity, DeliveryHealthState, ProjectDeliveryHealthDto } from './health.js';
import type { MilestoneStatus } from './planning.js';
import type { ProjectDto, ProjectStatusReportSummaryDto } from './projects.js';
import type { WorkItemQuery } from './work-items.js';

export type PortfolioReportFreshness = 'fresh' | 'stale' | 'missing';
export type PortfolioAttentionType =
  | 'delivery_risk'
  | 'dependency_pressure'
  | 'communication_freshness'
  | 'current_execution';
export type PortfolioLinkQueryScope = 'workspace' | 'project';

export interface PortfolioSummaryDto {
  activeProjectCount: number;
  blockedProjectCount: number;
  atRiskProjectCount: number;
  onTrackProjectCount: number;
  overdueProjectCount: number;
  dependencyPressureProjectCount: number;
  missingOrStaleReportProjectCount: number;
}

export interface PortfolioReportSummaryDto {
  freshness: PortfolioReportFreshness;
  thresholdDays: number;
  latestReport: ProjectStatusReportSummaryDto | null;
  daysSincePublished: number | null;
}

export interface PortfolioMilestoneSummaryDto {
  id: string;
  name: string;
  status: MilestoneStatus;
  health: DeliveryHealthState;
  openCount: number;
  targetDate: string | null;
}

export interface PortfolioCycleSummaryDto {
  id: string;
  name: string;
  health: DeliveryHealthState;
  openWorkCount: number;
  endDate: string;
  targetPoints: number | null;
}

export interface PortfolioPlanningSummaryDto {
  activeMilestone: PortfolioMilestoneSummaryDto | null;
  activeCycle: PortfolioCycleSummaryDto | null;
}

export interface PortfolioLinkDto {
  label: string;
  route: string;
  query?: WorkItemQuery;
  queryScope?: PortfolioLinkQueryScope;
}

export interface PortfolioProjectLinksDto {
  overview: PortfolioLinkDto;
  work: PortfolioLinkDto;
  planning: PortfolioLinkDto;
  reports: PortfolioLinkDto;
  latestReport?: PortfolioLinkDto;
  activeMilestone?: PortfolioLinkDto;
  activeCycle?: PortfolioLinkDto;
  blockedWork?: PortfolioLinkDto;
  dependencyBlockedWork?: PortfolioLinkDto;
  overdueWork?: PortfolioLinkDto;
  staleWork?: PortfolioLinkDto;
}

export interface PortfolioProjectRowDto {
  project: ProjectDto;
  deliveryHealth: ProjectDeliveryHealthDto;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  dependencyBlockedWorkItemCount: number;
  blockingOpenWorkItemCount: number;
  overdueWorkItemCount: number;
  staleInProgressWorkItemCount: number;
  updatedAt: string;
  report: PortfolioReportSummaryDto;
  planning: PortfolioPlanningSummaryDto;
  links: PortfolioProjectLinksDto;
}

export interface PortfolioAttentionItemDto {
  type: PortfolioAttentionType;
  project: ProjectDto;
  title: string;
  message: string;
  severity: DeliveryHealthSeverity;
  link: PortfolioLinkDto;
}

export interface PortfolioAttentionSectionsDto {
  needsAttention: PortfolioAttentionItemDto[];
  communicationFreshness: PortfolioAttentionItemDto[];
  currentExecution: PortfolioAttentionItemDto[];
  dependencyPressure: PortfolioAttentionItemDto[];
}

export interface PortfolioDto {
  generatedAt: string;
  reportFreshnessThresholdDays: number;
  summary: PortfolioSummaryDto;
  attention: PortfolioAttentionSectionsDto;
  projects: PortfolioProjectRowDto[];
}
