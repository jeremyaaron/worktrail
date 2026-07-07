import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MemberDto, SavedWorkViewDto } from '@worktrail/contracts';

import { PinnedSavedViewsComponent } from './pinned-saved-views.component';

const owner: MemberDto = {
  id: 'member-1',
  workspaceId: 'workspace-1',
  name: 'Avery Owner',
  email: 'avery@example.com',
  role: 'owner',
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const baseView: SavedWorkViewDto = {
  id: 'saved-view-1',
  workspaceId: 'workspace-1',
  projectId: null,
  owner,
  name: 'Base view',
  scope: 'workspace',
  visibility: 'personal',
  isPinned: true,
  query: {
    workState: 'open'
  },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
};

function savedView(input: Partial<SavedWorkViewDto>): SavedWorkViewDto {
  return {
    ...baseView,
    ...input
  };
}

describe('PinnedSavedViewsComponent', () => {
  let fixture: ComponentFixture<PinnedSavedViewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinnedSavedViewsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PinnedSavedViewsComponent);
  });

  it('hides itself when there are no pinned views', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.pinned-views')).toBeNull();
    expect(compiled.textContent?.trim()).toBe('');
  });

  it('renders shared shortcuts before personal shortcuts and sorts each group by name', () => {
    const sharedBeta = savedView({
      id: 'shared-beta',
      name: 'Beta shared',
      visibility: 'workspace'
    });
    const sharedAlpha = savedView({
      id: 'shared-alpha',
      name: 'Alpha shared',
      visibility: 'workspace'
    });
    const personalZulu = savedView({
      id: 'personal-zulu',
      name: 'Zulu personal'
    });
    const personalAlpha = savedView({
      id: 'personal-alpha',
      name: 'Alpha personal'
    });

    fixture.componentInstance.sharedViews = [sharedBeta, sharedAlpha];
    fixture.componentInstance.personalViews = [personalZulu, personalAlpha];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = [...compiled.querySelectorAll<HTMLButtonElement>('.pinned-view')];

    expect(compiled.textContent).toContain('2 shared · 2 personal');
    expect(
      buttons.map((button) => ({
        name: button.querySelector('.pinned-view__name')?.textContent,
        badge: button.querySelector('.pinned-view__badge')?.textContent
      }))
    ).toEqual([
      { name: 'Alpha shared', badge: 'Shared' },
      { name: 'Beta shared', badge: 'Shared' },
      { name: 'Alpha personal', badge: 'Personal' },
      { name: 'Zulu personal', badge: 'Personal' }
    ]);
  });

  it('emits open with the selected saved view', () => {
    const opened: SavedWorkViewDto[] = [];
    const sharedView = savedView({
      id: 'shared-risk',
      name: 'Dependency risks',
      visibility: 'workspace'
    });

    fixture.componentInstance.sharedViews = [sharedView];
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.pinned-view')?.click();

    expect(opened).toEqual([sharedView]);
  });

  it('sets accessible names that distinguish shared and personal shortcuts', () => {
    fixture.componentInstance.sharedViews = [
      savedView({
        id: 'shared-ready',
        name: 'Ready for pickup',
        visibility: 'workspace'
      })
    ];
    fixture.componentInstance.personalViews = [
      savedView({
        id: 'personal-open',
        name: 'My open work'
      })
    ];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = [...compiled.querySelectorAll<HTMLButtonElement>('.pinned-view')];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open pinned shared view Ready for pickup',
      'Open pinned personal view My open work'
    ]);
  });

  it('allows heading copy to be customized without route context', () => {
    fixture.componentInstance.heading = 'Project pinned views';
    fixture.componentInstance.sharedViews = [
      savedView({
        id: 'project-shared',
        projectId: 'project-1',
        scope: 'project',
        name: 'Release blockers',
        visibility: 'workspace'
      })
    ];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toBe('Project pinned views');
    expect(compiled.textContent).toContain('Release blockers');
  });
});
