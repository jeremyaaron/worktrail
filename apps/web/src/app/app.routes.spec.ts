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
    expect(paths).toContain('work-items');
    expect(paths).toContain('work-items/new');
    expect(paths.indexOf('work-items/new')).toBeLessThan(paths.indexOf('work-items/:workItemId'));
    expect(paths).toContain('projects/:projectId/work-items/new');
  });
});
