import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProjectCycleDto } from '@worktrail/contracts';

import { CycleManagerComponent, type CycleUpdateRequest } from './cycle-manager.component';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000201';

const activeCycle: ProjectCycleDto = {
  id: '10000000-0000-4000-8000-000000000701',
  workspaceId,
  projectId,
  name: 'v0.2.1 Cycle Planning',
  goal: 'Prove cycle planning across assignment, reviews, reports, and exports.',
  status: 'active',
  startDate: '2026-07-13',
  endDate: '2026-07-24',
  targetPoints: 20,
  isArchived: false,
  archivedAt: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z'
};

function createCycleForm(): FormGroup {
  const formBuilder = TestBed.inject(FormBuilder);
  return formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    goal: [''],
    status: ['planned'],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    targetPoints: ['']
  });
}

describe('CycleManagerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleManagerComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('renders editable cycles and emits mutation events', () => {
    const fixture = TestBed.createComponent(CycleManagerComponent);
    fixture.componentInstance.projectId = projectId;
    fixture.componentInstance.cycleForm = createCycleForm();
    fixture.componentInstance.cycles = [activeCycle];
    fixture.componentInstance.creatableCycleStatuses = ['planned', 'active'];
    fixture.componentInstance.mutableCycleStatuses = ['planned', 'active', 'canceled'];
    fixture.componentInstance.canManageCycles = true;
    fixture.detectChanges();

    const createSpy = spyOn(fixture.componentInstance.create, 'emit');
    const updateSpy = spyOn(fixture.componentInstance.update, 'emit');
    const archiveSpy = spyOn(fixture.componentInstance.archive, 'emit');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Cycles');
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.querySelector<HTMLAnchorElement>('.cycle-row__links a')?.getAttribute('href')).toBe(
      `/projects/${projectId}/cycles/${activeCycle.id}`
    );

    compiled.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    expect(createSpy).toHaveBeenCalled();

    const nameInput = compiled.querySelector<HTMLInputElement>('.cycle-row input')!;
    nameInput.value = 'v0.2.1 Launch';
    nameInput.dispatchEvent(new Event('input'));
    const saveButton = [...compiled.querySelectorAll<HTMLButtonElement>('.cycle-actions button')]
      .find((button) => button.textContent?.includes('Save'));
    saveButton?.click();

    expect(updateSpy).toHaveBeenCalled();
    expect((updateSpy.calls.mostRecent().args[0] as CycleUpdateRequest).name).toBe(
      'v0.2.1 Launch'
    );

    const archiveButton = [...compiled.querySelectorAll<HTMLButtonElement>('.cycle-actions button')]
      .find((button) => button.textContent?.includes('Archive'));
    archiveButton?.click();
    expect(archiveSpy).toHaveBeenCalledWith(activeCycle);
  });

  it('hides mutation controls in read-only mode', () => {
    const fixture = TestBed.createComponent(CycleManagerComponent);
    fixture.componentInstance.projectId = projectId;
    fixture.componentInstance.cycleForm = createCycleForm();
    fixture.componentInstance.cycles = [activeCycle];
    fixture.componentInstance.creatableCycleStatuses = ['planned', 'active'];
    fixture.componentInstance.mutableCycleStatuses = ['planned', 'active', 'canceled'];
    fixture.componentInstance.canManageCycles = false;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('v0.2.1 Cycle Planning');
    expect(compiled.querySelector('form')).toBeNull();
    expect(compiled.querySelector('.cycle-actions')).toBeNull();
  });

  it('shows loading, load error, and create error states', () => {
    const fixture = TestBed.createComponent(CycleManagerComponent);
    fixture.componentInstance.projectId = projectId;
    fixture.componentInstance.cycleForm = createCycleForm();
    fixture.componentInstance.creatableCycleStatuses = ['planned', 'active'];
    fixture.componentInstance.mutableCycleStatuses = ['planned', 'active', 'canceled'];
    fixture.componentInstance.canManageCycles = true;
    fixture.componentInstance.isLoadingCycles = true;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading cycles');

    fixture.componentInstance.isLoadingCycles = false;
    fixture.componentInstance.cycleLoadError = 'Project cycles could not be loaded from the API.';
    fixture.componentInstance.cycleCreateError = 'Cycle name is required.';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project cycles could not be loaded from the API.');
    expect(compiled.textContent).toContain('Cycle name is required.');
  });
});
