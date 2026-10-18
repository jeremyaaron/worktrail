import { describe, expect, it } from 'vitest';

import { createNavigationTarget, navigationContextFromPage, parseWorkNavigationTarget, recordNavigationTarget, recordOriginParams, returnNavigationTarget, workNavigationContext } from './work-navigation';

describe('bounded work navigation', () => {
  const origin = '/projects/p/work-items?status=blocked&estimateState=unestimated&page=3&pageSize=10';
  it('preserves applied filters and paging across parent/child/immediate return and reload', () => {
    const parent = recordNavigationTarget('parent', workNavigationContext(origin, null));
    const child = recordNavigationTarget('child', workNavigationContext(parent.queryParams!['returnUrl'], parent.queryParams!['returnTo']), '/work-items/parent#history');
    expect(child.queryParams).toEqual({ returnUrl: origin, returnTo: '/work-items/parent#history' });
    const reloaded = workNavigationContext(child.queryParams!['returnUrl'], child.queryParams!['returnTo'], '/work-items', 'child');
    const back = returnNavigationTarget(reloaded);
    expect(back.path).toBe('/work-items/parent');
    expect(back.fragment).toBe('history');
    expect(back.queryParams).toEqual({ returnUrl: origin });
    expect(returnNavigationTarget(workNavigationContext(back.queryParams!['returnUrl'], null)).url).toBe(origin);
    expect(recordNavigationTarget('parent', reloaded, '/work-items/child').queryParams).toEqual({ returnUrl: origin });
  });

  it('replaces rather than nests immediate records through repeated traversal', () => {
    let context = workNavigationContext(origin, null);
    for (let i = 0; i < 100; i++) {
      const target = recordNavigationTarget('item-' + (i + 1), context, '/work-items/item-' + i);
      expect(target.queryParams!['returnTo']).toBe('/work-items/item-' + i);
      expect(target.url.length).toBeLessThan(512);
      context = workNavigationContext(target.queryParams!['returnUrl'], target.queryParams!['returnTo']);
    }
  });

  it('accepts a bare legacy record origin with a project Work fallback', () => {
    const context = workNavigationContext('/work-items/parent#dependencies', null, '/projects/p/work-items', 'child');
    expect(context.origin.path).toBe('/projects/p/work-items');
    expect(returnNavigationTarget(context).fragment).toBe('dependencies');
    expect(returnNavigationTarget(context).queryParams).toEqual({ returnUrl: '/projects/p/work-items' });
  });

  it('inherits record context for Quick Find without copying nested navigation parameters', () => {
    const source = recordNavigationTarget('parent', workNavigationContext(origin, null), undefined, 'files');
    const context = navigationContextFromPage(source.url);
    expect(context.origin.url).toBe(origin);
    expect(context.immediate?.url).toBe('/work-items/parent#files');
    expect(recordNavigationTarget('child', context).queryParams!['returnTo']).toBe('/work-items/parent#files');
    expect(recordNavigationTarget('parent', context).queryParams).toEqual({ returnUrl: origin });
  });

  it('carries list/review and parent context through create success', () => {
    const create = createNavigationTarget('p', 'parent', workNavigationContext(origin, null), '/work-items/parent#discussion');
    expect(create.queryParams).toEqual({ returnUrl: origin, returnTo: '/work-items/parent#discussion', parentWorkItemId: 'parent' });
    const success = recordNavigationTarget('new-child', workNavigationContext(create.queryParams!['returnUrl'], create.queryParams!['returnTo']));
    expect(success.queryParams!['returnTo']).toBe('/work-items/parent#discussion');
  });

  for (const url of ['/projects/p/planning?view=cycles#cycles-heading', '/projects/p/planning?view=milestones#milestones-heading', '/projects/p/cycles/c#cycle-result-heading', '/projects/p/cycles/c/closeout#unfinished-heading', '/projects/p/status/r#report-summary-heading', '/work-items/a#comment-10000000-0000-4000-8000-000000000001']) {
    it('preserves recognized destinations: ' + url, () => expect(parseWorkNavigationTarget(url)?.url).toBe(url));
  }

  for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/work-items/%2Fetc', '/work-items/%252fetc', '/work-items/%ZZ', '/work-items/a%00', '/work-items/(a//other:b)', '/work-items/a;admin=true', '/work-items?returnUrl=%2Finbox', '/work-items/a?returnTo=%2Fwork-items%2Fb', '/unknown/path', '/projects/p/planning?view=invalid', '/projects/p/planning#milestone-name', '/work-items?status=invalid', '/work-items?page=0', '/work-items?pageSize=500', '/work-items?blocked=maybe', '/work-items?status=ready&status=blocked', '/work-items?unknown=x', '/work-items?__proto__=x', '/projects/p/work-items?projectId=q', '/work-items?search=%0Asecret', '/work-items/a#unknown', '/work-items/new']) {
    it('rejects unsafe/unknown context: ' + url, () => {
      expect(parseWorkNavigationTarget(url)).toBeNull();
      expect(workNavigationContext(url, null, '/projects/p/work-items').origin.path).toBe('/projects/p/work-items');
    });
  }

  it('rejects the whole invalid pair and self-return loops', () => {
    expect(workNavigationContext(origin, '/unknown', '/work-items').origin.url).toBe('/work-items');
    expect(workNavigationContext(origin, '/work-items/self#files', '/work-items', 'self').immediate).toBeNull();
    expect(workNavigationContext('/work-items/self', null, '/work-items', 'self').origin.path).toBe('/work-items');
  });

  it('bounds decoded targets and constructed navigation and never repeatedly decodes search data', () => {
    expect(parseWorkNavigationTarget('/work-items?search=' + 'x'.repeat(4096))).toBeNull();
    expect(parseWorkNavigationTarget('/work-items?search=%252Fadmin')?.queryParams!['search']).toBe('%2Fadmin');
    expect(new TextEncoder().encode(recordNavigationTarget('a', workNavigationContext('/work-items?search=' + 'x'.repeat(4000), null)).url).length).toBeLessThanOrEqual(12288);
    const context = workNavigationContext(origin, null);
    const forged = { ...context, origin: { ...context.origin, url: 'x'.repeat(13000) } };
    expect(recordNavigationTarget('a', forged).queryParams).toEqual({ returnUrl: '/work-items' });
    expect(createNavigationTarget('p', 'parent', forged).queryParams).toEqual({ returnUrl: '/work-items', parentWorkItemId: 'parent' });
    expect(recordOriginParams('/work-items?search=' + 'x'.repeat(5000))).toEqual({ returnUrl: '/work-items' });
  });

  it('labels validated destinations and does not use URL query author content as a label', () => {
    expect(workNavigationContext(origin, null).origin.label).toBe('Back to filtered work');
    expect(parseWorkNavigationTarget('/projects/p/cycles/c')?.label).toBe('Back to cycle review');
    expect(parseWorkNavigationTarget('/work-items?search=Secret%20title')?.label).toBe('Back to filtered work');
  });
});
