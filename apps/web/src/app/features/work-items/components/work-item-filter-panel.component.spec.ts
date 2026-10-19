import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(fixture.componentInstance.isExpanded()).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isExpanded()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits apply and collapses after submission', () => {
    const applySpy = vi.fn<(value: void) => void>().mockName('apply');
    fixture.componentInstance.apply.subscribe(applySpy);
    fixture.componentInstance.isExpanded.set(true);
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(applySpy).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(fixture.componentInstance.isExpanded()).toBe(false);
  });
});
