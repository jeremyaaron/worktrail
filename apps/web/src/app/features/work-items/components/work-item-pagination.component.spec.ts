import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { WorkItemPageMetadataDto } from '@worktrail/contracts';

import { WorkItemPaginationComponent } from './work-item-pagination.component';

describe('WorkItemPaginationComponent', () => {
  let fixture: ComponentFixture<WorkItemPaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkItemPaginationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkItemPaginationComponent);
  });

  it('renders a bounded start window with one gap', () => {
    render(metadata({ page: 1, totalPages: 12, hasNextPage: true }));

    expect(renderedPages()).toEqual([1, 2, 3, 12]);
    expect(compiled().querySelectorAll('.pagination__ellipsis')).toHaveSize(1);
  });

  it('renders neighbors and both gaps in the middle of the range', () => {
    render(
      metadata({ page: 6, totalPages: 12, hasPreviousPage: true, hasNextPage: true })
    );

    expect(renderedPages()).toEqual([1, 5, 6, 7, 12]);
    expect(compiled().querySelectorAll('.pagination__ellipsis')).toHaveSize(2);
    expect(
      compiled().querySelector<HTMLButtonElement>('[aria-current="page"]')?.textContent?.trim()
    ).toBe('6');
  });

  it('renders a bounded end window with one gap', () => {
    render(metadata({ page: 12, totalPages: 12, hasPreviousPage: true }));

    expect(renderedPages()).toEqual([1, 10, 11, 12]);
    expect(compiled().querySelectorAll('.pagination__ellipsis')).toHaveSize(1);
  });

  it('emits previous, direct, next, and changed page-size requests', () => {
    const pages: number[] = [];
    const pageSizes: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => pages.push(page));
    fixture.componentInstance.pageSizeChange.subscribe((pageSize) => pageSizes.push(pageSize));
    render(
      metadata({
        page: 6,
        pageSize: 25,
        totalPages: 12,
        hasPreviousPage: true,
        hasNextPage: true
      })
    );

    directionButton('Previous').click();
    compiled().querySelector<HTMLButtonElement>('[aria-label="Page 1"]')?.click();
    directionButton('Next').click();
    selectPageSize(50);

    expect(pages).toEqual([5, 1, 7]);
    expect(pageSizes).toEqual([50]);
  });

  it('uses native disabled states at boundaries and while loading', () => {
    render(metadata({ page: 1, totalPages: 3, hasNextPage: true }));

    expect(directionButton('Previous').disabled).toBeTrue();
    expect(directionButton('Next').disabled).toBeFalse();

    fixture.componentInstance.disabled = true;
    fixture.detectChanges();

    expect(
      Array.from(compiled().querySelectorAll<HTMLButtonElement>('button')).every(
        (button) => button.disabled
      )
    ).toBeTrue();
    expect(compiled().querySelector<HTMLSelectElement>('select')?.disabled).toBeTrue();

    fixture.componentInstance.disabled = false;
    fixture.componentInstance.metadata = metadata({
      page: 3,
      totalPages: 3,
      hasPreviousPage: true
    });
    fixture.detectChanges();

    expect(directionButton('Previous').disabled).toBeFalse();
    expect(directionButton('Next').disabled).toBeTrue();
  });

  it('renders no controls or false page text for an empty result', () => {
    render(metadata({ totalCount: 0, totalPages: 0 }));

    expect(compiled().querySelector('nav')).toBeNull();
    expect(compiled().textContent).not.toContain('Page 1 of 0');
  });

  it('provides navigation, current-page, and visible page-size labels', () => {
    render(metadata({ page: 2, totalPages: 4, hasPreviousPage: true, hasNextPage: true }));

    expect(compiled().querySelector('nav')?.getAttribute('aria-label')).toBe('Work item pages');
    expect(compiled().querySelector('.pagination__pages')?.getAttribute('role')).toBe('group');
    expect(compiled().querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe(
      'Page 2, current page'
    );
    expect(compiled().querySelector('.pagination__size span')?.textContent?.trim()).toBe(
      'Items per page'
    );
    expect(
      Array.from(compiled().querySelectorAll('option')).map((option) => option.textContent)
    ).toEqual(['10', '25', '50', '100']);
    expect(
      Array.from(compiled().querySelectorAll('button, select')).map(
        (control) =>
          control instanceof HTMLSelectElement
            ? 'Items per page'
            : control.textContent?.trim() ?? ''
      )
    ).toEqual(['Previous', '1', '2', '3', '4', 'Next', 'Items per page']);
  });

  it('marks numeric neighbors and status text for the compact mobile contract', () => {
    render(
      metadata({ page: 6, totalPages: 12, hasPreviousPage: true, hasNextPage: true })
    );

    expect(compiled().querySelector('.pagination__status')?.textContent?.trim()).toBe(
      'Page 6 of 12'
    );
    expect(
      compiled().querySelectorAll('.pagination__page:not(.pagination__page--current)')
    ).toHaveSize(4);
    expect(compiled().querySelectorAll('.pagination__page--current')).toHaveSize(1);
  });

  function render(value: WorkItemPageMetadataDto): void {
    fixture.componentInstance.metadata = value;
    fixture.detectChanges();
  }

  function metadata(
    overrides: Partial<WorkItemPageMetadataDto> = {}
  ): WorkItemPageMetadataDto {
    return {
      page: 1,
      pageSize: 25,
      totalCount: 12,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
      ...overrides
    };
  }

  function compiled(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function renderedPages(): number[] {
    return Array.from(compiled().querySelectorAll<HTMLButtonElement>('.pagination__page')).map(
      (button) => Number(button.textContent?.trim())
    );
  }

  function directionButton(label: 'Previous' | 'Next'): HTMLButtonElement {
    const button = Array.from(
      compiled().querySelectorAll<HTMLButtonElement>('.pagination__direction')
    ).find((candidate) => candidate.textContent?.trim() === label);

    if (button === undefined) {
      throw new Error(`${label} button not found.`);
    }

    return button;
  }

  function selectPageSize(pageSize: number): void {
    const select = compiled().querySelector<HTMLSelectElement>('select');

    if (select === null) {
      throw new Error('Page-size select not found.');
    }

    select.value = String(pageSize);
    select.dispatchEvent(new Event('change'));
  }
});
