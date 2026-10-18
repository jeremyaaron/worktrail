import type { ActivatedRouteSnapshot } from '@angular/router';

export type ProjectSection = 'overview' | 'work' | 'board' | 'planning' | 'reports' | 'settings';

export function projectSectionFromSnapshot(snapshot: ActivatedRouteSnapshot): ProjectSection | null {
  for (const child of snapshot.children) {
    const section = projectSectionFromSnapshot(child);
    if (section) return section;
  }
  const section: unknown = snapshot.data?.['projectSection'];
  return section === 'overview' || section === 'work' || section === 'board' || section === 'planning' || section === 'reports' || section === 'settings' ? section : null;
}
