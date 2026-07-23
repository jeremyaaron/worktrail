import type {
  DeliveryHealthState,
  QuickFindAttachmentResultDto,
  QuickFindCycleResultDto,
  QuickFindGroupDto,
  QuickFindMatchDto,
  QuickFindMilestoneResultDto,
  QuickFindProjectContextDto,
  QuickFindProjectResultDto,
  QuickFindReportResultDto,
  QuickFindRequest,
  QuickFindResponseDto,
  QuickFindWorkItemContextDto,
  QuickFindWorkItemResultDto
} from '@worktrail/contracts';

import type { ActorContext } from '../domain/actor.js';
import { QuickFindUnavailableError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type {
  QuickFindAttachmentRecord,
  QuickFindCycleRecord,
  QuickFindMilestoneRecord,
  QuickFindProjectContextRecord,
  QuickFindProjectRecord,
  QuickFindRepositoryGroup,
  QuickFindReportRecord,
  QuickFindWorkItemContextRecord,
  QuickFindWorkItemRecord
} from '../repositories/quick-find-repository.js';

const quickFindGroupLimit = 5;
const deliveryHealthStates = new Set<DeliveryHealthState>([
  'healthy',
  'at_risk',
  'blocked',
  'complete',
  'inactive'
]);

export interface QuickFindServiceContext {
  actor: ActorContext;
  repositories: Pick<Repositories, 'quickFind'>;
}

export class QuickFindService {
  constructor(private readonly context: QuickFindServiceContext) {}

  async search(input: QuickFindRequest): Promise<QuickFindResponseDto> {
    try {
      const result = await this.context.repositories.quickFind.searchWorkspace({
        workspaceId: this.context.actor.workspaceId,
        query: input.query,
        groupLimit: quickFindGroupLimit
      });

      return {
        query: input.query,
        groups: {
          workItems: mapGroup(result.workItems, mapWorkItem),
          projects: mapGroup(result.projects, mapProject),
          milestones: mapGroup(result.milestones, mapMilestone),
          cycles: mapGroup(result.cycles, mapCycle),
          reports: mapGroup(result.reports, mapReport),
          attachments: mapGroup(result.attachments, mapAttachment)
        }
      };
    } catch {
      throw new QuickFindUnavailableError();
    }
  }
}

function mapGroup<TRecord, TDto>(
  group: QuickFindRepositoryGroup<TRecord>,
  mapItem: (record: TRecord) => TDto
): QuickFindGroupDto<TDto> {
  return {
    items: group.items.map(mapItem),
    hasMore: group.hasMore
  };
}

function mapProject(record: QuickFindProjectRecord): QuickFindProjectResultDto {
  return {
    kind: 'project',
    project: mapProjectContext(record.project),
    match: mapMatch(record.match)
  };
}

function mapWorkItem(record: QuickFindWorkItemRecord): QuickFindWorkItemResultDto {
  return {
    kind: 'work_item',
    project: mapProjectContext(record.project),
    workItem: mapWorkItemContext(record.workItem),
    match: mapMatch(record.match)
  };
}

function mapMilestone(record: QuickFindMilestoneRecord): QuickFindMilestoneResultDto {
  return {
    kind: 'milestone',
    project: mapProjectContext(record.project),
    milestone: {
      id: record.milestone.id,
      name: record.milestone.name,
      status: record.milestone.status,
      targetDate: record.milestone.targetDate,
      isArchived: record.milestone.isArchived
    },
    match: mapMatch(record.match)
  };
}

function mapCycle(record: QuickFindCycleRecord): QuickFindCycleResultDto {
  return {
    kind: 'cycle',
    project: mapProjectContext(record.project),
    cycle: {
      id: record.cycle.id,
      name: record.cycle.name,
      status: record.cycle.status,
      startDate: record.cycle.startDate,
      endDate: record.cycle.endDate,
      isArchived: record.cycle.isArchived
    },
    match: mapMatch(record.match)
  };
}

function mapReport(record: QuickFindReportRecord): QuickFindReportResultDto {
  assertDeliveryHealth(record.report.health);

  return {
    kind: 'report',
    project: mapProjectContext(record.project),
    report: {
      id: record.report.id,
      title: record.report.title,
      statusDate: record.report.statusDate,
      health: record.report.health,
      publishedAt: record.report.publishedAt.toISOString()
    },
    match: mapMatch(record.match)
  };
}

function mapAttachment(record: QuickFindAttachmentRecord): QuickFindAttachmentResultDto {
  return {
    kind: 'attachment',
    project: mapProjectContext(record.project),
    workItem: mapWorkItemContext(record.workItem),
    attachment: {
      id: record.attachment.id,
      fileName: record.attachment.fileName,
      byteSize: record.attachment.byteSize,
      createdAt: record.attachment.createdAt.toISOString()
    },
    match: mapMatch(record.match)
  };
}

function mapProjectContext(
  project: QuickFindProjectContextRecord
): QuickFindProjectContextDto {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    status: project.status
  };
}

function mapWorkItemContext(
  workItem: QuickFindWorkItemContextRecord
): QuickFindWorkItemContextDto {
  return {
    id: workItem.id,
    displayKey: workItem.displayKey,
    title: workItem.title,
    status: workItem.status,
    type: workItem.type
  };
}

function mapMatch(match: QuickFindMatchDto): QuickFindMatchDto {
  return {
    field: match.field,
    mode: match.mode,
    excerpt: match.excerpt
  };
}

function assertDeliveryHealth(value: unknown): asserts value is DeliveryHealthState {
  if (!deliveryHealthStates.has(value as DeliveryHealthState)) {
    throw new Error('Quick Find report health is invalid.');
  }
}
