import { afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type {
  QuickFindProjectContextDto,
  QuickFindResponseDto,
  QuickFindWorkItemContextDto
} from '@worktrail/contracts';
import { Subject } from 'rxjs';

import { QuickFindApi } from '../../core/api/quick-find-api';
import { CurrentUserService } from '../../core/current-user.service';
import { QuickFindDialogComponent } from './quick-find-dialog.component';

const sectionTargets: HTMLElement[] = [];

describe('QuickFindDialogComponent search mode', () => {
  const project: QuickFindProjectContextDto = {
    id: 'project-1',
    key: 'WT',
    name: 'Worktrail',
    status: 'archived'
  };
  const workItem: QuickFindWorkItemContextDto = {
    id: 'work-item-1',
    displayKey: 'WT-42',
    title: 'Release evidence',
    status: 'done',
    type: 'story'
  };

  let fixture: ComponentFixture<QuickFindDialogComponent>;
  let component: QuickFindDialogComponent;
  let api: Mocked<Pick<QuickFindApi, 'search'>>;
  let dialogRef: Mocked<Pick<DialogRef<void, QuickFindDialogComponent>, 'close' | 'closed'>>;
  let dialogClosed: Subject<void>;
  let selectedMember: WritableSignal<{ id: string; workspaceId?: string } | null>;
  let router: Router;

  beforeEach(async () => {
    api = { search: vi.fn<QuickFindApi['search']>() };
    dialogClosed = new Subject<void>();
    dialogRef = {
      close: vi.fn<DialogRef<void, QuickFindDialogComponent>['close']>(),
      closed: dialogClosed.asObservable()
    };
    selectedMember = signal<{ id: string; workspaceId?: string } | null>({ id: 'member-1' });

    await TestBed.configureTestingModule({
      imports: [QuickFindDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { currentProjectId: project.id } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: QuickFindApi, useValue: api },
        {
          provide: CurrentUserService,
          useValue: {
            selectedMember
          }
        },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(QuickFindDialogComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('retains query and preview filters on reopening but refreshes results and resets selection', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const first = new Subject<QuickFindResponseDto>();
    const second = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValueOnce(first).mockReturnValueOnce(second);
    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    first.next(fullResponse());
    first.complete();
    component.resultType.set('cycles');
    component.projectFilter.set(project.id);
    fixture.detectChanges();
    expect(component.resultGroups().length).toBe(1);
    fixture.destroy();
    fixture = TestBed.createComponent(QuickFindDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.queryControl.value).toBe('release');
    expect(component.resultType()).toBe('cycles');
    expect(component.projectFilter()).toBe(project.id);
    expect(component.response()).toBeNull();
    expect(component.activeOptionId()).toBeNull();
    await vi.advanceTimersByTimeAsync(220);
    expect(api.search).toHaveBeenCalledTimes(2);
    const fresh = fullResponse();
    fresh.groups.cycles.items[0]!.cycle.name = 'Fresh cycle name';
    second.next(fresh);
    second.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fresh cycle name');
    expect(fixture.nativeElement.querySelectorAll('.quick-find__result').length).toBe(1);
    component.clearSearch();
    fixture.detectChanges();
    expect(component.resultType()).toBe('all');
    expect(component.projectFilter()).toBe('');
  });

  it('erases state and rejects an earlier response when workspace changes without a different member ID', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const pending = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(pending);
    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    selectedMember.set({ id: 'member-1', workspaceId: 'different-workspace' });
    pending.next(fullResponse());
    fixture.detectChanges();
    expect(component.response()).toBeNull();
    expect(dialogRef.close).toHaveBeenCalled();
    fixture.destroy();
    fixture = TestBed.createComponent(QuickFindDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.queryControl.value).toBe('');
  });
  it('debounces normalized queries and cancels stale success and error outcomes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const first = new Subject<QuickFindResponseDto>();
    const second = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValueOnce(first).mockReturnValueOnce(second);

    component.queryControl.setValue('  release   evidence ');
    fixture.detectChanges();

    expect(component.normalizedQuery()).toBe('release evidence');
    expect(component.isLoading()).toBe(true);
    expect(api.search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(219);
    expect(api.search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(api.search).toHaveBeenCalledExactlyOnceWith({ query: 'release evidence' });

    component.queryControl.setValue('release notes');
    fixture.detectChanges();

    expect(component.response()).toBeNull();
    expect(first.observed).toBe(false);

    first.next(responseWithWorkItem('release evidence', 'Stale success'));
    first.error(new Error('Stale error'));
    fixture.detectChanges();
    expect(component.response()).toBeNull();
    expect(component.error()).toBeNull();

    await vi.advanceTimersByTimeAsync(220);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.search.mock.lastCall!).toEqual([{ query: 'release notes' }]);

    second.next(responseWithWorkItem('release notes', 'Current success'));
    second.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Current success');
    expect(fixture.nativeElement.textContent).not.toContain('Stale success');
    expect(component.isLoading()).toBe(false);
  });

  it('renders non-empty groups in product order with readable context and plain text', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const result = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(result);

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    result.next(fullResponse());
    result.complete();
    fixture.detectChanges();

    const headings = [...fixture.nativeElement.querySelectorAll('.quick-find__result-group h3')]
      .map((heading: HTMLElement) => heading.textContent?.trim());

    expect(headings).toEqual([
      'Work items · 1 shown',
      'Projects · 1 shown',
      'Milestones · 1 shown',
      'Cycles · 1 shown',
      'Reports · 1 shown',
      'Attachments · 1 shown'
    ]);
    expect(fixture.nativeElement.textContent).toContain('WT-42');
    expect(fixture.nativeElement.textContent).toContain('Worktrail');
    expect(fixture.nativeElement.textContent).toContain('Story');
    expect(fixture.nativeElement.textContent).toContain('At risk');
    expect(fixture.nativeElement.textContent).toContain('Archived project');
    expect(fixture.nativeElement.textContent).toContain('Completed work item');
    expect(fixture.nativeElement.textContent).toContain('Archived milestone');
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fixture.nativeElement.querySelector('.quick-find__excerpt img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[innerHTML]')).toBeNull();
  });

  it('shows honest truncation and only creates overflow state for work items', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const result = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(result);

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    result.next(fullResponse());
    result.complete();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.quick-find__more').length
    ).toBe(2);
    expect(
      fixture.nativeElement.querySelectorAll('#quick-find-work-item-overflow').length
    ).toBe(1);
    expect(component.resultOptions().filter((option) => option.type === 'work_item_overflow'))
      .toEqual([{ type: 'work_item_overflow', query: 'release' }]);
  });

  it('preserves the query on safe error, retries immediately, and clears to navigation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const failed = new Subject<QuickFindResponseDto>();
    const retried = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValueOnce(failed).mockReturnValueOnce(retried);

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    failed.error(new Error('database details release'));
    fixture.detectChanges();

    expect(component.queryControl.value).toBe('release');
    expect(fixture.nativeElement.textContent).toContain(
      'Quick Find is temporarily unavailable.'
    );
    expect(fixture.nativeElement.textContent).not.toContain('database details');

    component.retrySearch();
    expect(component.isLoading()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.search.mock.lastCall!).toEqual([{ query: 'release' }]);

    retried.next(emptyResponse('release'));
    retried.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No results');

    component.clearSearch();
    fixture.detectChanges();
    expect(component.queryControl.value).toBe('');
    expect(component.isNavigationMode()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Global');
  });

  it('invalidates pending search state and closes when the selected actor changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const pending = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(pending);

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    expect(api.search).toHaveBeenCalledTimes(1);

    selectedMember.set({ id: 'member-2' });
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith();

    pending.next(responseWithWorkItem('release', 'Wrong actor result'));
    pending.complete();
    fixture.detectChanges();
    expect(component.response()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Wrong actor result');
  });

  it('keeps focus in the combobox while moving through bounded navigation options', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    document.body.append(fixture.nativeElement);
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#quick-find-query'
    )!;
    input.focus();

    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBe('quick-find-options');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'quick-find-navigation-global-my-work'
    );

    dispatchKey(input, 'ArrowUp');
    expect(component.activeOptionId()).toBe('quick-find-navigation-global-my-work');

    dispatchKey(input, 'End');
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(component.activeOptionId()).toBe('quick-find-navigation-project-settings');
    expect(document.activeElement).toBe(input);

    dispatchKey(input, 'ArrowDown');
    expect(component.activeOptionId()).toBe('quick-find-navigation-project-settings');

    dispatchKey(input, 'Home');
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(component.activeOptionId()).toBe('quick-find-navigation-global-my-work');

    expect(dispatchKey(input, 'Tab').defaultPrevented).toBe(false);
    expect(dispatchKey(input, 'Escape').defaultPrevented).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();

    const callOrder: string[] = [];
    dialogRef.close.mockImplementation(() => {
      callOrder.push('close');
    });
    vi.spyOn(router, 'navigate').mockImplementation(async () => {
      callOrder.push('navigate');
      return true;
    });
    dispatchKey(input, 'Enter');
    await vi.advanceTimersByTimeAsync(0);

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith();
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/my-work'], {});
    expect(callOrder).toEqual(['navigate', 'close']);
  });

  it('keeps the query and active result when navigation is rejected', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.spyOn(router, 'navigate').mockResolvedValue(false);
    component.queryControl.setValue('xy');
    await vi.advanceTimersByTimeAsync(220);
    component.queryControl.setValue('');
    await vi.advanceTimersByTimeAsync(0);
    const option = component.selectableOptions()[0];
    const active = component.activeOptionId();
    component.activateOption(option);
    await vi.advanceTimersByTimeAsync(0);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.queryControl.value).toBe('');
    expect(component.activeOptionId()).toBe(active);
  });

  it('synchronizes active-descendant state across loading, results, hover, and clear', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const result = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(result);
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#quick-find-query'
    )!;

    component.queryControl.setValue('release');
    fixture.detectChanges();

    expect(component.activeOptionId()).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);

    await vi.advanceTimersByTimeAsync(220);
    result.next(fullResponse());
    result.complete();
    fixture.detectChanges();

    expect(component.activeOptionId()).toBe('quick-find-work-item-work-item-1');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'quick-find-work-item-work-item-1'
    );
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(7);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-label')).toContain(
      'WT-42, Release evidence, WT · Worktrail'
    );

    const report = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '#quick-find-report-report-1'
    )!;
    report.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(component.activeOptionId()).toBe('quick-find-report-report-1');
    expect(report.getAttribute('aria-selected')).toBe('true');

    component.clearSearch();
    fixture.detectChanges();
    expect(component.activeOptionId()).toBe('quick-find-navigation-global-my-work');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'quick-find-navigation-global-my-work'
    );
  });

  it('routes every result and overflow through canonical navigation destinations before closing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const result = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(result);
    const callOrder: string[] = [];
    dialogRef.close.mockImplementation(() => {
      callOrder.push('close');
    });
    const navigate = vi.spyOn(router, 'navigate').mockImplementation(async () => {
      callOrder.push('navigate');
      return true;
    });

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    result.next(fullResponse());
    result.complete();
    fixture.detectChanges();

    for (const option of component.resultOptions()) {
      component.activateOption(option);
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(navigate.mock.calls).toEqual([
      [['/work-items', 'work-item-1'], { queryParams: { returnUrl: '/projects/project-1/work-items' } }],
      [
        ['/work-items'],
        {
          queryParams: {
            search: 'release',
            archivedProjects: 'include'
          }
        }
      ],
      [['/projects', 'project-1'], {}],
      [['/projects', 'project-1', 'milestones', 'milestone-1'], {}],
      [['/projects', 'project-1', 'cycles', 'cycle-1'], {}],
      [['/projects', 'project-1', 'status', 'report-1'], {}],
      [['/work-items', 'work-item-1'], { queryParams: { returnUrl: '/projects/project-1/work-items' }, fragment: 'files' }]
    ]);
    expect(callOrder).toEqual([
      'navigate', 'close',
      'navigate', 'close',
      'navigate', 'close',
      'navigate', 'close',
      'navigate', 'close',
      'navigate', 'close',
      'navigate', 'close'
    ]);
  });

  it('gives pointer and keyboard activation the same destination', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const first = new Subject<QuickFindResponseDto>();
    api.search.mockReturnValue(first);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#quick-find-query'
    )!;

    component.queryControl.setValue('release');
    await vi.advanceTimersByTimeAsync(220);
    first.next(responseWithWorkItem('release', 'Release evidence'));
    first.complete();
    fixture.detectChanges();

    dispatchKey(input, 'Enter');
    const keyboardDestination = navigate.mock.lastCall!;

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('#quick-find-work-item-work-item-1')!
      .click();
    const pointerDestination = navigate.mock.lastCall!;

    expect(pointerDestination).toEqual(keyboardDestination);
    expect(pointerDestination).toEqual([['/work-items', 'work-item-1'], { queryParams: { returnUrl: '/projects/project-1/work-items' } }]);
  });

  it('focuses Files after close when Angular would skip the same attachment URL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const target = document.createElement('section');
    target.id = 'files';
    target.tabIndex = -1;
    sectionTargets.push(target);
    document.body.append(target);
    const focus = vi.spyOn(target, 'focus').mockImplementation(() => undefined);
    const scrollIntoView = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => undefined);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/work-items/work-item-1?returnUrl=%2Fwork-items#files');
    dialogRef.close.mockImplementation(() => {
      dialogClosed.next();
      dialogClosed.complete();
    });
    const attachmentResult = fullResponse().groups.attachments.items[0];

    component.activateOption({ type: 'result', result: attachmentResult });
    await vi.advanceTimersByTimeAsync(0);

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith();
    expect(navigate).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start' });
    target.remove();
  });

  it('leaves a changed record Files target to its readiness owner instead of focusing a stale node', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const target = document.createElement('section');
    target.id = 'files';
    sectionTargets.push(target);
    document.body.append(target);
    const focus = vi.spyOn(target, 'focus').mockImplementation(() => undefined);
    let url = '/work-items/previous?returnUrl=%2Fmy-work#files';
    vi.spyOn(router, 'url', 'get').mockImplementation(() => url);
    vi.spyOn(router, 'navigate').mockImplementation(async (commands, extras) => {
      url = router.serializeUrl(router.createUrlTree(commands, extras));
      return true;
    });
    dialogRef.close.mockImplementation(() => { dialogClosed.next(); dialogClosed.complete(); });
    component.activateOption({ type: 'result', result: fullResponse().groups.attachments.items[0] });
    await vi.advanceTimersByTimeAsync(0);
    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith();
    expect(focus).not.toHaveBeenCalled();
    target.remove();
  });

  function fullResponse(): QuickFindResponseDto {
    return {
      query: 'release',
      groups: {
        workItems: {
          items: [
            {
              kind: 'work_item',
              project,
              workItem,
              match: {
                field: 'work_item_description',
                mode: 'substring',
                excerpt: '<img src=x onerror=alert(1)>'
              }
            }
          ],
          hasMore: true
        },
        projects: {
          items: [
            {
              kind: 'project',
              project,
              match: { field: 'project_name', mode: 'substring', excerpt: null }
            }
          ],
          hasMore: true
        },
        milestones: {
          items: [
            {
              kind: 'milestone',
              project,
              milestone: {
                id: 'milestone-1',
                name: 'Public release',
                status: 'completed',
                targetDate: '2026-08-01',
                isArchived: true
              },
              match: {
                field: 'milestone_description',
                mode: 'substring',
                excerpt: 'Release acceptance'
              }
            }
          ],
          hasMore: false
        },
        cycles: {
          items: [
            {
              kind: 'cycle',
              project,
              cycle: {
                id: 'cycle-1',
                name: 'Release cycle',
                status: 'active',
                startDate: '2026-07-01',
                endDate: '2026-07-31',
                isArchived: false
              },
              match: { field: 'cycle_name', mode: 'prefix', excerpt: null }
            }
          ],
          hasMore: false
        },
        reports: {
          items: [
            {
              kind: 'report',
              project,
              report: {
                id: 'report-1',
                title: 'Release status',
                statusDate: '2026-07-23',
                health: 'at_risk',
                publishedAt: '2026-07-23T16:00:00.000Z'
              },
              match: {
                field: 'report_summary',
                mode: 'substring',
                excerpt: 'Release risk summary'
              }
            }
          ],
          hasMore: false
        },
        attachments: {
          items: [
            {
              kind: 'attachment',
              project,
              workItem,
              attachment: {
                id: 'attachment-1',
                fileName: 'release-evidence.pdf',
                byteSize: 1536,
                createdAt: '2026-07-23T16:00:00.000Z'
              },
              match: {
                field: 'attachment_file_name',
                mode: 'prefix',
                excerpt: null
              }
            }
          ],
          hasMore: false
        }
      }
    };
  }

  function responseWithWorkItem(query: string, title: string): QuickFindResponseDto {
    const response = emptyResponse(query);
    response.groups.workItems.items.push({
      kind: 'work_item',
      project: { ...project, status: 'active' },
      workItem: { ...workItem, title, status: 'in_progress' },
      match: { field: 'work_item_title', mode: 'substring', excerpt: null }
    });
    return response;
  }

  function emptyResponse(query: string): QuickFindResponseDto {
    return {
      query,
      groups: {
        workItems: { items: [], hasMore: false },
        projects: { items: [], hasMore: false },
        milestones: { items: [], hasMore: false },
        cycles: { items: [], hasMore: false },
        reports: { items: [], hasMore: false },
        attachments: { items: [], hasMore: false }
      }
    };
  }

  function dispatchKey(input: HTMLInputElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }
});


afterEach(() => {
  try {
    TestBed.resetTestingModule();
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const target of sectionTargets) target.remove();
    sectionTargets.length = 0;
    localStorage.removeItem('worktrail.selectedMemberId');
  }
});
