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
  owner,
  name: 'Open owner work',
  visibility: 'personal',
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
    fixture.componentInstance.workspaceViews = [sharedView];
    fixture.componentInstance.canManageWorkspaceViews = true;
    fixture.componentInstance.draftNames = {
      [savedView.id]: savedView.name,
      [sharedView.id]: sharedView.name
    };
    fixture.componentInstance.saveWorkspace.subscribe((name) => sharedSaves.push(name));
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.componentInstance.rename.subscribe((view) => renamed.push(view));
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
    expect(opened).toEqual([sharedView]);
    expect(renamed).toEqual([sharedView]);
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
});
