import { routes } from './app.routes';

describe('routes', () => {
  it('uses My Work as the default route', () => {
    expect(routes.find((route) => route.path === '')).toEqual(
      jasmine.objectContaining({
        pathMatch: 'full',
        redirectTo: 'my-work'
      })
    );
    expect(routes.find((route) => route.path === '**')).toEqual(
      jasmine.objectContaining({
        redirectTo: 'my-work'
      })
    );
  });

  it('registers workspace-level work item routes before work item detail', () => {
    const paths = routes.map((route) => route.path);

    expect(paths).toContain('my-work');
    expect(paths).toContain('inbox');
    expect(paths).toContain('portfolio');
    expect(paths).toContain('work-items');
    expect(paths).toContain('work-items/new');
    expect(paths.indexOf('work-items/new')).toBeLessThan(paths.indexOf('work-items/:workItemId'));
  });

  it('registers Inbox as a lazy route', () => {
    const inboxRoute = routes.find((route) => route.path === 'inbox');

    expect(inboxRoute?.loadComponent).toBeDefined();
    expect(inboxRoute?.title).toBe('Inbox | Worktrail');
  });

  it('registers Portfolio as a lazy route', () => {
    const portfolioRoute = routes.find((route) => route.path === 'portfolio');

    expect(portfolioRoute?.loadComponent).toBeDefined();
    expect(portfolioRoute?.title).toBe('Portfolio | Worktrail');
  });

  it('nests project routes under the project shell while preserving child URLs', () => {
    const projectRoute = routes.find((route) => route.path === 'projects/:projectId');
    const childPaths = projectRoute?.children?.map((route) => route.path);

    expect(projectRoute?.loadComponent).toBeDefined();
    expect(childPaths).toEqual([
      '',
      'work-items/new',
      'work-items/import',
      'work-items',
      'board',
      'planning',
      'status',
      'status/new',
      'status/:reportId',
      'milestones/:milestoneId',
      'cycles/:cycleId',
      'settings'
    ]);
    expect(childPaths?.indexOf('work-items/import')).toBeLessThan(
      childPaths?.indexOf('work-items') ?? -1
    );
    expect(childPaths?.indexOf('status/new')).toBeLessThan(
      childPaths?.indexOf('status/:reportId') ?? -1
    );
  });
});
