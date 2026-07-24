import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  QuickFindProjectContextDto,
  QuickFindResponseDto,
  QuickFindWorkItemContextDto
} from '@worktrail/contracts';
import { Subject } from 'rxjs';

import { QuickFindApi } from '../../core/api/quick-find-api';
import { CurrentUserService } from '../../core/current-user.service';
import { QuickFindDialogComponent } from './quick-find-dialog.component';

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
  let api: jasmine.SpyObj<QuickFindApi>;
  let dialogRef: jasmine.SpyObj<DialogRef<void, QuickFindDialogComponent>>;
  let selectedMember: WritableSignal<{ id: string } | null>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<QuickFindApi>('QuickFindApi', ['search']);
    dialogRef = jasmine.createSpyObj<DialogRef<void, QuickFindDialogComponent>>(
      'DialogRef',
      ['close']
    );
    selectedMember = signal<{ id: string } | null>({ id: 'member-1' });

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
    fixture.detectChanges();
  });

  it('debounces normalized queries and cancels stale success and error outcomes', fakeAsync(() => {
    const first = new Subject<QuickFindResponseDto>();
    const second = new Subject<QuickFindResponseDto>();
    api.search.and.returnValues(first, second);

    component.queryControl.setValue('  release   evidence ');
    fixture.detectChanges();

    expect(component.normalizedQuery()).toBe('release evidence');
    expect(component.isLoading()).toBeTrue();
    expect(api.search).not.toHaveBeenCalled();

    tick(219);
    expect(api.search).not.toHaveBeenCalled();

    tick(1);
    expect(api.search).toHaveBeenCalledOnceWith({ query: 'release evidence' });

    component.queryControl.setValue('release notes');
    fixture.detectChanges();

    expect(component.response()).toBeNull();
    expect(first.observed).toBeFalse();

    first.next(responseWithWorkItem('release evidence', 'Stale success'));
    first.error(new Error('Stale error'));
    fixture.detectChanges();
    expect(component.response()).toBeNull();
    expect(component.error()).toBeNull();

    tick(220);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.search.calls.mostRecent().args).toEqual([{ query: 'release notes' }]);

    second.next(responseWithWorkItem('release notes', 'Current success'));
    second.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Current success');
    expect(fixture.nativeElement.textContent).not.toContain('Stale success');
    expect(component.isLoading()).toBeFalse();
  }));

  it('renders non-empty groups in product order with readable context and plain text', fakeAsync(() => {
    const result = new Subject<QuickFindResponseDto>();
    api.search.and.returnValue(result);

    component.queryControl.setValue('release');
    tick(220);
    result.next(fullResponse());
    result.complete();
    fixture.detectChanges();

    const headings = [...fixture.nativeElement.querySelectorAll('.quick-find__result-group h3')]
      .map((heading: HTMLElement) => heading.textContent?.trim());

    expect(headings).toEqual([
      'Work items',
      'Projects',
      'Milestones',
      'Cycles',
      'Reports',
      'Attachments'
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
  }));

  it('shows honest truncation and only creates overflow state for work items', fakeAsync(() => {
    const result = new Subject<QuickFindResponseDto>();
    api.search.and.returnValue(result);

    component.queryControl.setValue('release');
    tick(220);
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
  }));

  it('preserves the query on safe error, retries immediately, and clears to navigation', fakeAsync(() => {
    const failed = new Subject<QuickFindResponseDto>();
    const retried = new Subject<QuickFindResponseDto>();
    api.search.and.returnValues(failed, retried);

    component.queryControl.setValue('release');
    tick(220);
    failed.error(new Error('database details release'));
    fixture.detectChanges();

    expect(component.queryControl.value).toBe('release');
    expect(fixture.nativeElement.textContent).toContain(
      'Quick Find is temporarily unavailable.'
    );
    expect(fixture.nativeElement.textContent).not.toContain('database details');

    component.retrySearch();
    expect(component.isLoading()).toBeTrue();
    tick(0);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.search.calls.mostRecent().args).toEqual([{ query: 'release' }]);

    retried.next(emptyResponse('release'));
    retried.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No results');

    component.clearSearch();
    fixture.detectChanges();
    expect(component.queryControl.value).toBe('');
    expect(component.isNavigationMode()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Global');
  }));

  it('invalidates pending search state and closes when the selected actor changes', fakeAsync(() => {
    const pending = new Subject<QuickFindResponseDto>();
    api.search.and.returnValue(pending);

    component.queryControl.setValue('release');
    tick(220);
    expect(api.search).toHaveBeenCalledTimes(1);

    selectedMember.set({ id: 'member-2' });
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledOnceWith();

    pending.next(responseWithWorkItem('release', 'Wrong actor result'));
    pending.complete();
    fixture.detectChanges();
    expect(component.response()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Wrong actor result');
  }));

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
});
