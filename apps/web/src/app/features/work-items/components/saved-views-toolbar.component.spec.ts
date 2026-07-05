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

describe('SavedViewsToolbarComponent', () => {
  let fixture: ComponentFixture<SavedViewsToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedViewsToolbarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SavedViewsToolbarComponent);
    fixture.componentInstance.savedViews = [savedView];
    fixture.componentInstance.draftNames = { [savedView.id]: savedView.name };
  });

  it('keeps management compact and emits save/open actions', () => {
    const saves: string[] = [];
    const opened: SavedWorkViewDto[] = [];
    fixture.componentInstance.save.subscribe((name) => saves.push(name));
    fixture.componentInstance.open.subscribe((view) => opened.push(view));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 personal views');
    expect(compiled.querySelector('details')?.hasAttribute('open')).toBeFalse();

    fixture.componentInstance.newViewName = 'Blocked risks';
    fixture.componentInstance.saveRequested();
    expect(saves).toEqual(['Blocked risks']);

    compiled.querySelector<HTMLDetailsElement>('details')?.setAttribute('open', '');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.saved-view-actions button')?.click();
    expect(opened).toEqual([savedView]);
  });
});
