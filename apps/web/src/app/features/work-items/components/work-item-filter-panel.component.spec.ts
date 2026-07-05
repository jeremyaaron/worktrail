import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';

import { WorkItemFilterPanelComponent } from './work-item-filter-panel.component';

describe('WorkItemFilterPanelComponent', () => {
  let fixture: ComponentFixture<WorkItemFilterPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemFilterPanelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkItemFilterPanelComponent);
    fixture.componentInstance.formGroup = new FormGroup({});
  });

  it('toggles the compact filter body for narrow layouts', () => {
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector('.filters__toggle') as HTMLButtonElement;
    expect(fixture.componentInstance.isExpanded()).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isExpanded()).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits apply and collapses after submission', () => {
    const applySpy = jasmine.createSpy('apply');
    fixture.componentInstance.apply.subscribe(applySpy);
    fixture.componentInstance.isExpanded.set(true);
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(applySpy).toHaveBeenCalledOnceWith(undefined);
    expect(fixture.componentInstance.isExpanded()).toBeFalse();
  });
});
