import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MemberDto, SavedWorkViewDto } from '@worktrail/contracts';

import { SavedViewsToolbarComponent } from './saved-views-toolbar.component';

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

const savedView: SavedWorkViewDto = {
  id: 'saved-view-1',
  workspaceId: 'workspace-1',
  projectId: null,
  owner,
  name: 'Open owner work',
  scope: 'workspace',
  visibility: 'personal',
  isPinned: false,
  query: {
    assigneeId: owner.id,
    workState: 'open'
  },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const sharedView: SavedWorkViewDto = {
  ...savedView,
  id: 'saved-view-shared',
  name: 'Dependency risks',
  visibility: 'workspace',
  query: {
    dependency: 'dependency_blocked',
    sort: 'priority_desc'
  }
};

const pinnedSavedView: SavedWorkViewDto = {
  ...savedView,
  id: 'saved-view-pinned',
  name: 'Pinned owner work',
  isPinned: true
};

describe('SavedViewsToolbarComponent', () => {
  let fixture: ComponentFixture<SavedViewsToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedViewsToolbarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SavedViewsToolbarComponent);
    fixture.componentInstance.personalViews = [savedView];
    fixture.componentInstance.draftNames = { [savedView.id]: savedView.name };
  });

  it('keeps management compact and emits personal save/open actions', () => {
    const saves: string[] = [];
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.savePersonal.subscribe((name) => saves.push(name));
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0 shared · 1 personal');
    expect(compiled.textContent).toContain('Personal views');
    expect(compiled.querySelector('details')?.hasAttribute('open')).toBeFalse();

    fixture.componentInstance.newViewName = 'Blocked risks';
    fixture.componentInstance.saveRequested('personal');
    expect(saves).toEqual(['Blocked risks']);

    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.saved-view-actions button')?.click();
    expect(opened).toEqual([savedView]);
  });

  it('separates shared views above personal views and emits shared saves for managers', () => {
    const sharedSaves: string[] = [];
    const opened: SavedWorkViewDto[] = [];
    const renamed: SavedWorkViewDto[] = [];
    const pinChanges: Array<{ savedView: SavedWorkViewDto; isPinned: boolean }> = [];
    fixture.componentInstance.workspaceViews = [sharedView];
    fixture.componentInstance.canManageWorkspaceViews = true;
    fixture.componentInstance.draftNames = {
      [savedView.id]: savedView.name,
      [sharedView.id]: sharedView.name
    };
    fixture.componentInstance.saveWorkspace.subscribe((name) => sharedSaves.push(name));
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.componentInstance.rename.subscribe((view) => renamed.push(view));
    fixture.componentInstance.pinChange.subscribe((change) => pinChanges.push(change));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 shared · 1 personal');
    expect(compiled.textContent).toContain('Shared views');
    expect(compiled.textContent).toContain('Personal views');
    expect(compiled.textContent?.indexOf('Dependency risks')).toBeLessThan(
      compiled.textContent?.indexOf('Open owner work') ?? 0
    );

    fixture.componentInstance.newViewName = 'Ready for pickup';
    compiled.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
    expect(sharedSaves).toEqual(['Ready for pickup']);

    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();
    const actionButtons = [...compiled.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')];
    actionButtons[0]?.click();
    actionButtons[1]?.click();
    actionButtons[3]?.click();
    expect(opened).toEqual([sharedView]);
    expect(renamed).toEqual([sharedView]);
    expect(pinChanges).toEqual([{ savedView: sharedView, isPinned: true }]);
  });

  it('lets contributors open shared views without showing shared management actions', () => {
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.personalViews = [];
    fixture.componentInstance.workspaceViews = [sharedView];
    fixture.componentInstance.canManageWorkspaceViews = false;
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Owners and maintainers manage shared saved views.');
    expect(compiled.textContent).not.toContain('Save shared view');
    expect(compiled.querySelector<HTMLDetailsElement>('details')?.hasAttribute('open')).toBeFalse();

    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();

    const buttons = [...compiled.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    buttons[0]?.click();
    expect(opened).toEqual([sharedView]);
    expect(compiled.querySelector('input[value="Dependency risks"]')).toBeNull();
  });

  it('summarizes saved view queries without default-only filter noise', () => {
    fixture.componentInstance.personalViews = [
      {
        ...savedView,
        id: 'saved-view-default',
        name: 'Default view',
        query: {
          archivedProjects: 'exclude',
          search: ' ',
          sort: 'updated_desc'
        }
      },
      {
        ...savedView,
        id: 'saved-view-ready',
        name: 'Ready view',
        query: {
          sort: 'updated_desc',
          status: 'ready'
        }
      }
    ];
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Default workspace view');
    expect(text).toContain('1 applied filter');
  });

  it('renders project-specific empty and helper copy without route context', () => {
    fixture.componentInstance.personalViews = [];
    fixture.componentInstance.sharedViews = [sharedView];
    fixture.componentInstance.querySummaryScope = 'project';
    fixture.componentInstance.emptyMessage = 'Save the current filters to reuse this project view.';
    fixture.componentInstance.sharedHelper = 'Owners and maintainers manage shared project views.';
    fixture.componentInstance.sharedSectionLabel = 'Shared project views';
    fixture.componentInstance.personalSectionLabel = 'Personal project views';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Owners and maintainers manage shared project views.');
    expect(compiled.textContent).toContain('Shared project views');
    expect(compiled.textContent).toContain('Personal project views');

    fixture.componentInstance.sharedViews = [];
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Save the current filters to reuse this project view.');
  });

  it('counts project saved-view query fields with project semantics', () => {
    fixture.componentInstance.querySummaryScope = 'project';
    fixture.componentInstance.personalViews = [
      {
        ...savedView,
        id: 'saved-view-project-default',
        name: 'Default project view',
        scope: 'project',
        projectId: 'project-1',
        query: {
          archivedProjects: 'include',
          projectId: 'project-1',
          sort: 'updated_desc'
        }
      },
      {
        ...savedView,
        id: 'saved-view-project-risk',
        name: 'Project risk view',
        scope: 'project',
        projectId: 'project-1',
        query: {
          archivedProjects: 'include',
          projectId: 'project-1',
          priority: 'urgent'
        }
      }
    ];
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Default project view');
    expect(text).toContain('1 applied filter');
    expect(text).not.toContain('3 applied filters');
  });

  it('keeps personal view management available when shared management is read-only', () => {
    const renamed: SavedWorkViewDto[] = [];
    fixture.componentInstance.personalViews = [savedView];
    fixture.componentInstance.sharedViews = [sharedView];
    fixture.componentInstance.canManageSharedViews = false;
    fixture.componentInstance.rename.subscribe((view) => renamed.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();

    const sections = [...compiled.querySelectorAll<HTMLElement>('.saved-view-section')];
    const sharedButtons = [
      ...sections[0]!.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')
    ];
    const personalButtons = [
      ...sections[1]!.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')
    ];

    expect(sharedButtons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    expect(personalButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Rename',
      'Update query',
      'Pin',
      'Delete'
    ]);

    personalButtons[1]?.click();
    expect(renamed).toEqual([savedView]);
  });

  it('emits personal pin and unpin actions for mutable personal views', () => {
    const pinChanges: Array<{ savedView: SavedWorkViewDto; isPinned: boolean }> = [];
    fixture.componentInstance.personalViews = [savedView, pinnedSavedView];
    fixture.componentInstance.draftNames = {
      [savedView.id]: savedView.name,
      [pinnedSavedView.id]: pinnedSavedView.name
    };
    fixture.componentInstance.pinChange.subscribe((change) => pinChanges.push(change));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();

    const personalRows = [...compiled.querySelectorAll<HTMLElement>('.saved-view-row')];
    const unpinnedButtons = [
      ...personalRows[0]!.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')
    ];
    const pinnedButtons = [
      ...personalRows[1]!.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')
    ];

    expect(unpinnedButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Rename',
      'Update query',
      'Pin',
      'Delete'
    ]);
    expect(pinnedButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Rename',
      'Update query',
      'Unpin',
      'Delete'
    ]);

    unpinnedButtons[3]?.click();
    pinnedButtons[3]?.click();

    expect(pinChanges).toEqual([
      { savedView, isPinned: true },
      { savedView: pinnedSavedView, isPinned: false }
    ]);
  });

  it('does not render pin controls when all saved views are read-only', () => {
    fixture.componentInstance.personalViews = [savedView];
    fixture.componentInstance.sharedViews = [sharedView];
    fixture.componentInstance.canManagePersonalViews = false;
    fixture.componentInstance.canManageSharedViews = false;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = [...compiled.querySelectorAll<HTMLButtonElement>('.saved-view-actions button')];

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open', 'Open']);
    expect(compiled.textContent).not.toContain('Pin');
    expect(compiled.textContent).not.toContain('Unpin');
  });
});
