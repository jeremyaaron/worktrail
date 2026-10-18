import type { WorkItemStatus } from '../domain/constants.js';
import { ConflictError, ValidationError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/index.js';
import type { WorkItem } from '../repositories/types.js';

const boardPositionStep = 1024;
export class WorkItemBoardPositions {
  async getTopInsertionPosition(
    projectId: string,
    status: WorkItemStatus,
    repositories: Repositories
  ): Promise<number> {
    const topPosition = await repositories.workItems.getTopBoardPosition(projectId, status);
    return topPosition === null ? boardPositionStep : topPosition - boardPositionStep;
  }

  async computeBoardPosition(input: {
    projectId: string;
    status: WorkItemStatus;
    movingWorkItemId: string;
    beforeWorkItemId: string | null;
    afterWorkItemId: string | null;
    repositories: Repositories;
  }): Promise<number> {
    if (
      input.beforeWorkItemId === input.movingWorkItemId ||
      input.afterWorkItemId === input.movingWorkItemId
    ) {
      throw new ValidationError('A work item cannot be positioned relative to itself.');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const completeColumn = await input.repositories.workItems.listByProjectAndStatusForBoard(input.projectId, input.status);
      const currentIndex = completeColumn.findIndex(({ id }) => id === input.movingWorkItemId);
      if (attempt === 0 && currentIndex !== -1 && (
        (input.beforeWorkItemId === null && input.afterWorkItemId === null && currentIndex === 0) ||
        ((completeColumn[currentIndex - 1]?.id ?? null) === input.beforeWorkItemId &&
          (completeColumn[currentIndex + 1]?.id ?? null) === input.afterWorkItemId)
      )) return completeColumn[currentIndex]!.boardPosition;
      const column = completeColumn.filter((item) => item.id !== input.movingWorkItemId);

      const position = this.tryComputeBoardPosition({
        column,
        beforeWorkItemId: input.beforeWorkItemId,
        afterWorkItemId: input.afterWorkItemId
      });

      if (position !== null) {
        return position;
      }

      await input.repositories.workItems.compactBoardPositions(input.projectId, input.status, input.movingWorkItemId);
    }

    throw new ConflictError('Board column could not be rebalanced.');
  }

  private tryComputeBoardPosition(input: {
    column: WorkItem[];
    beforeWorkItemId: string | null;
    afterWorkItemId: string | null;
  }): number | null {
    if (input.beforeWorkItemId === null && input.afterWorkItemId === null) {
      const first = input.column[0];
      return first === undefined ? boardPositionStep : first.boardPosition - boardPositionStep;
    }

    const beforeIndex =
      input.beforeWorkItemId === null
        ? -1
        : input.column.findIndex((item) => item.id === input.beforeWorkItemId);
    const afterIndex =
      input.afterWorkItemId === null
        ? input.column.length
        : input.column.findIndex((item) => item.id === input.afterWorkItemId);

    if (
      beforeIndex === -1 &&
      input.beforeWorkItemId !== null ||
      afterIndex === -1 &&
      input.afterWorkItemId !== null
    ) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    if (afterIndex !== beforeIndex + 1) {
      throw new ValidationError('Board move neighbors are stale.');
    }

    if (input.beforeWorkItemId === null) {
      const after = input.column[afterIndex];
      return after === undefined ? boardPositionStep : after.boardPosition - boardPositionStep;
    }

    const before = input.column[beforeIndex];

    if (before === undefined) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    if (input.afterWorkItemId === null) {
      return before.boardPosition + boardPositionStep;
    }

    const after = input.column[afterIndex];

    if (after === undefined) {
      throw new ValidationError('Board move neighbors are invalid for the target status.');
    }

    const gap = after.boardPosition - before.boardPosition;

    if (gap <= 1) {
      return null;
    }

    return before.boardPosition + Math.floor(gap / 2);
  }
}
