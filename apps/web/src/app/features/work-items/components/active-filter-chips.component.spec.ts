import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveFilterChipsComponent } from './active-filter-chips.component';

describe('ActiveFilterChipsComponent', () => {
  let fixture: ComponentFixture<ActiveFilterChipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveFilterChipsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveFilterChipsComponent);
  });

  it('renders active labels and emits removals without changing label text', () => {
    const removed: string[] = [];
    fixture.componentInstance.labels = ['Status: Ready', 'Label: design'];
    fixture.componentInstance.remove.subscribe((label) => removed.push(label));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(compiled.querySelectorAll('.active-filters span')).map((chip) =>
      chip.childNodes[0].textContent?.trim()
    );

    expect(labels).toEqual(['Status: Ready', 'Label: design']);
    compiled.querySelector<HTMLButtonElement>('button[aria-label="Remove Label: design"]')?.click();
    expect(removed).toEqual(['Label: design']);
  });
});
