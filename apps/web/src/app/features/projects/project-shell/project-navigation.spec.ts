import { describe, expect, it } from 'vitest';

import type { ActivatedRouteSnapshot } from '@angular/router';
import { routes } from '../../../app.routes';
import { projectSectionFromSnapshot } from './project-navigation';

describe('Project route navigation ownership', () => {
  const children = routes.find(route => route.path === 'projects/:projectId')!.children!;
  for (const path of ['planning', 'milestones/:milestoneId', 'cycles/:cycleId', 'cycles/:cycleId/closeout']) {
    it('assigns Planning to ' + path + ' without changing its lazy route', () => {
      const route = children.find(route => route.path === path)!;
      expect(route.loadComponent).toBeDefined();
      expect(route.data?.['projectSection']).toBe('planning');
      const snapshot = { data: {}, children: [{ data: route.data, children: [] }] } as unknown as ActivatedRouteSnapshot;
      expect(projectSectionFromSnapshot(snapshot)).toBe('planning');
    });
  }
  it('preserves editor metadata alongside section ownership', () => {
    expect(children.find(route => route.path === 'status/new')?.data).toEqual({ projectSection: 'reports', draftEditor: 'report' });
    expect(children.find(route => route.path === 'work-items/new')?.data).toEqual({ projectSection: 'work', draftEditor: 'create' });
  });
});
