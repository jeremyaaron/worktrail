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

  function selectManagedView(savedViewId: string): HTMLElement {
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLDetailsElement>('.saved-view-manager')?.setAttribute('open', '');
    fixture.detectChanges();

    const select = compiled.querySelector<HTMLSelectElement>('.saved-view-manage select');
    select!.value = savedViewId;
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    return compiled;
  }

  function managementButtons(compiled: HTMLElement): HTMLButtonElement[] {
    return [
      ...compiled.querySelectorAll<HTMLButtonElement>('.saved-view-management-actions button')
    ];
  }

  it('renders compact open select groups with query summaries', () => {
    fixture.componentInstance.sharedViews = [sharedView];
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const groups = [
      ...compiled.querySelectorAll<HTMLOptGroupElement>('.saved-view-open optgroup')
    ];

    expect(groups.map((group) => group.label)).toEqual(['Shared views', 'Personal views']);
    expect(groups[0]?.textContent).toContain('Dependency risks - 2 applied filters');
    expect(groups[1]?.textContent).toContain('Open owner work - 2 applied filters');

    const select = compiled.querySelector<HTMLSelectElement>('.saved-view-open select');
    select!.value = savedView.id;
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(compiled.querySelector('.saved-view-selected-summary')?.textContent).toContain(
      'Personal view · 2 applied filters'
    );
  });

  it('disables compact open action until a saved view is selected', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector<HTMLButtonElement>('.saved-view-open button');

    expect(button?.disabled).toBeTrue();
  });

  it('opens a shared saved view from the compact opener', () => {
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.sharedViews = [sharedView];
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector<HTMLSelectElement>('.saved-view-open select');
    select!.value = sharedView.id;
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.saved-view-open button')?.click();
    fixture.detectChanges();

    expect(opened).toEqual([sharedView]);
    expect(compiled.querySelector('.saved-view-opened')?.getAttribute('aria-live')).toBe('polite');
    expect(compiled.textContent).toContain('Opened "Dependency risks". Results updated below.');
  });

  it('opens a personal saved view from the compact opener', () => {
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector<HTMLSelectElement>('.saved-view-open select');
    select!.value = savedView.id;
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.saved-view-open button')?.click();

    expect(opened).toEqual([savedView]);
  });

  it('keeps management compact and emits personal save/open actions after selection', () => {
    const saves: string[] = [];
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.savePersonal.subscribe((name) => saves.push(name));
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0 shared · 1 personal');
    expect(compiled.querySelector('.saved-view-save summary')?.textContent?.trim()).toBe(
      'Save view'
    );
    expect(compiled.querySelector('.saved-view-manager summary')?.textContent?.trim()).toBe(
      'Manage views'
    );
    expect(
      compiled.querySelector<HTMLOptGroupElement>('.saved-view-manage optgroup')?.label
    ).toBe('Personal views');
    expect(compiled.querySelector<HTMLDetailsElement>('.saved-view-save')?.open).toBeFalse();
    expect(compiled.querySelector<HTMLDetailsElement>('.saved-view-manager')?.open).toBeFalse();

    fixture.componentInstance.newViewName = 'Blocked risks';
    fixture.componentInstance.saveRequested('personal');
    expect(saves).toEqual(['Blocked risks']);

    compiled.querySelector<HTMLDetailsElement>('.saved-view-manager')?.setAttribute('open', '');
    fixture.detectChanges();
    expect(compiled.querySelector('.saved-view-management-panel')).toBeNull();
    expect(compiled.textContent).toContain('Choose a saved view to inspect or manage it.');

    selectManagedView(savedView.id);
    managementButtons(compiled)[0]?.click();
    expect(opened).toEqual([savedView]);
  });

  it('separates shared views above personal views and emits shared saves for managers', () => {
    const sharedSaves: string[] = [];
    const opened: SavedWorkViewDto[] = [];
    const renamed: SavedWorkViewDto[] = [];
    const updated: SavedWorkViewDto[] = [];
    const deleted: SavedWorkViewDto[] = [];
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
    fixture.componentInstance.updateQuery.subscribe((view) => updated.push(view));
    fixture.componentInstance.delete.subscribe((view) => deleted.push(view));
    fixture.componentInstance.pinChange.subscribe((change) => pinChanges.push(change));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 shared · 1 personal');
    expect(
      [...compiled.querySelectorAll<HTMLOptGroupElement>('.saved-view-manage optgroup')].map(
        (group) => group.label
      )
    ).toEqual(['Shared views', 'Personal views']);
    expect(compiled.textContent?.indexOf('Dependency risks')).toBeLessThan(
      compiled.textContent?.indexOf('Open owner work') ?? 0
    );

    fixture.componentInstance.newViewName = 'Ready for pickup';
    compiled.querySelector<HTMLDetailsElement>('.saved-view-save')?.setAttribute('open', '');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.saved-view-save .secondary-action')?.click();
    expect(sharedSaves).toEqual(['Ready for pickup']);

    selectManagedView(sharedView.id);
    const actionButtons = managementButtons(compiled);
    expect(actionButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Update query',
      'Pin',
      'Rename',
      'Delete'
    ]);
    actionButtons[0]?.click();
    actionButtons[1]?.click();
    actionButtons[2]?.click();
    actionButtons[3]?.click();
    actionButtons[4]?.click();
    expect(opened).toEqual([sharedView]);
    expect(updated).toEqual([sharedView]);
    expect(renamed).toEqual([sharedView]);
    expect(deleted).toEqual([sharedView]);
    expect(pinChanges).toEqual([{ savedView: sharedView, isPinned: true }]);
  });

  it('lets contributors open shared views from a read-only selected panel', () => {
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.personalViews = [];
    fixture.componentInstance.workspaceViews = [sharedView];
    fixture.componentInstance.canManageWorkspaceViews = false;
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Owners and maintainers manage shared saved views.');
    expect(compiled.textContent).not.toContain('Save shared view');
    expect(compiled.querySelector<HTMLDetailsElement>('.saved-view-save')?.open).toBeFalse();
    expect(compiled.querySelector<HTMLDetailsElement>('.saved-view-manager')?.open).toBeFalse();

    selectManagedView(sharedView.id);
    const buttons = managementButtons(compiled);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    buttons[0]?.click();
    expect(opened).toEqual([sharedView]);
    expect(compiled.querySelector('.saved-view-management-rename input')).toBeNull();
    expect(compiled.textContent).toContain('This saved view is read-only for your current role.');
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
    expect(
      [...compiled.querySelectorAll<HTMLOptGroupElement>('.saved-view-manage optgroup')].map(
        (group) => group.label
      )
    ).toEqual(['Shared project views']);

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
    selectManagedView(sharedView.id);
    const sharedButtons = managementButtons(compiled);

    expect(sharedButtons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    expect(compiled.querySelector('.saved-view-management-rename input')).toBeNull();

    selectManagedView(savedView.id);
    const personalButtons = managementButtons(compiled);
    expect(personalButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Update query',
      'Pin',
      'Rename',
      'Delete'
    ]);
    expect(compiled.querySelector('.saved-view-management-rename input')).not.toBeNull();

    personalButtons[3]?.click();
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
    selectManagedView(savedView.id);
    const unpinnedButtons = managementButtons(compiled);

    expect(unpinnedButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Update query',
      'Pin',
      'Rename',
      'Delete'
    ]);
    expect(compiled.querySelectorAll('.saved-view-management-rename input').length).toBe(1);
    expect(compiled.querySelector('.saved-view-row')).toBeNull();

    unpinnedButtons[2]?.click();

    selectManagedView(pinnedSavedView.id);
    const pinnedButtons = managementButtons(compiled);
    expect(pinnedButtons.map((button) => button.textContent?.trim())).toEqual([
      'Open',
      'Update query',
      'Unpin',
      'Rename',
      'Delete'
    ]);

    pinnedButtons[2]?.click();

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
    selectManagedView(savedView.id);
    let buttons = managementButtons(compiled);

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    expect(compiled.textContent).not.toContain('Update query');
    expect(compiled.textContent).not.toContain('Rename');
    expect(compiled.textContent).not.toContain('Delete');
    expect(compiled.textContent).not.toContain('Pin');

    selectManagedView(sharedView.id);
    buttons = managementButtons(compiled);

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open']);
    expect(compiled.textContent).not.toContain('Unpin');
  });
});
