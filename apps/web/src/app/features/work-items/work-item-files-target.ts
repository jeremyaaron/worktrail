import { focusSectionTarget } from '../../shared/navigation/section-target';
export const workItemFilesFragment = 'files';
export const workItemFilesTargetId = 'files';

export function focusWorkItemFilesTarget(
  target: HTMLElement | null = document.getElementById(workItemFilesTargetId)
): boolean {
  return focusWorkItemTarget(target);
}

export function focusWorkItemTarget(target: HTMLElement | null): boolean {
  return focusSectionTarget(target);
}
