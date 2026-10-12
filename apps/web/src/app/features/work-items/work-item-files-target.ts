export const workItemFilesFragment = 'files';
export const workItemFilesTargetId = 'files';

export function focusWorkItemFilesTarget(
  target: HTMLElement | null = document.getElementById(workItemFilesTargetId)
): boolean {
  if (target === null) {
    return false;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
  return true;
}
