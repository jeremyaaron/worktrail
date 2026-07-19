import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  workItemPageSizes,
  type WorkItemPageMetadataDto,
  type WorkItemPageSize
} from '@worktrail/contracts';

interface PageToken {
  key: string;
  page: number | null;
}

@Component({
  selector: 'app-work-item-pagination',
  template: `
    @if (metadata.totalCount > 0) {
      <nav class="pagination" aria-label="Work item pages">
        <p class="pagination__status" aria-live="polite">
          Page {{ metadata.page }} of {{ metadata.totalPages }}
        </p>

        <div class="pagination__navigation">
          <button
            type="button"
            class="pagination__direction"
            [disabled]="disabled || !metadata.hasPreviousPage"
            (click)="requestPage(metadata.page - 1)"
          >
            Previous
          </button>

          <div class="pagination__pages" role="group" aria-label="Choose a page">
            @for (token of pageTokens(); track token.key) {
              @if (token.page === null) {
                <span class="pagination__ellipsis" aria-hidden="true">&hellip;</span>
              } @else {
                <button
                  type="button"
                  class="pagination__page"
                  [class.pagination__page--current]="token.page === metadata.page"
                  [attr.aria-current]="token.page === metadata.page ? 'page' : null"
                  [attr.aria-label]="pageLabel(token.page)"
                  [disabled]="disabled"
                  (click)="requestPage(token.page)"
                >
                  {{ token.page }}
                </button>
              }
            }
          </div>

          <button
            type="button"
            class="pagination__direction"
            [disabled]="disabled || !metadata.hasNextPage"
            (click)="requestPage(metadata.page + 1)"
          >
            Next
          </button>
        </div>

        <label class="pagination__size">
          <span>Items per page</span>
          <select
            [value]="metadata.pageSize"
            [disabled]="disabled"
            (change)="requestPageSize($any($event.target).value)"
          >
            @for (pageSize of pageSizes; track pageSize) {
              <option [value]="pageSize">{{ pageSize }}</option>
            }
          </select>
        </label>
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .pagination {
      display: grid;
      grid-template-columns: minmax(110px, 1fr) auto minmax(150px, 1fr);
      gap: 14px;
      align-items: center;
      border-top: 1px solid #dbe3ee;
      padding-top: 16px;
    }

    .pagination__status {
      margin: 0;
      color: #475569;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .pagination__navigation,
    .pagination__pages {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    button,
    select {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #1f2937;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 750;
    }

    button {
      padding: 7px 11px;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      border-color: #1f4f99;
      color: #1f4f99;
    }

    button:focus-visible,
    select:focus-visible {
      outline: 3px solid #93c5fd;
      outline-offset: 2px;
    }

    button:disabled,
    select:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .pagination__page {
      width: 36px;
      padding-inline: 0;
      text-align: center;
    }

    .pagination__page--current {
      border-color: #1f4f99;
      background: #1f4f99;
      color: #ffffff;
    }

    .pagination__ellipsis {
      width: 20px;
      color: #64748b;
      text-align: center;
    }

    .pagination__size {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-self: end;
      color: #334155;
      font-size: 0.8125rem;
      font-weight: 750;
      white-space: nowrap;
    }

    .pagination__size select {
      min-width: 68px;
      padding: 0 28px 0 9px;
    }

    @media (max-width: 680px) {
      .pagination {
        grid-template-columns: 1fr auto;
      }

      .pagination__status {
        grid-column: 1 / -1;
        text-align: center;
      }

      .pagination__navigation {
        min-width: 0;
      }

      .pagination__page:not(.pagination__page--current),
      .pagination__ellipsis {
        display: none;
      }

      .pagination__size {
        min-width: 0;
      }
    }

    @media (max-width: 430px) {
      .pagination {
        grid-template-columns: 1fr;
      }

      .pagination__navigation,
      .pagination__size {
        justify-self: center;
      }
    }
  `
})
export class WorkItemPaginationComponent {
  @Input({ required: true }) metadata!: WorkItemPageMetadataDto;
  @Input() disabled = false;
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly pageSizeChange = new EventEmitter<WorkItemPageSize>();

  readonly pageSizes = workItemPageSizes;

  pageTokens(): PageToken[] {
    const { page, totalPages } = this.metadata;
    const visiblePages = new Set<number>([1, totalPages, page - 1, page, page + 1]);

    if (page <= 2) {
      visiblePages.add(3);
    }

    if (page >= totalPages - 1) {
      visiblePages.add(totalPages - 2);
    }

    const pages = [...visiblePages]
      .filter((candidate) => candidate >= 1 && candidate <= totalPages)
      .sort((left, right) => left - right);

    return pages.flatMap((candidate, index) => {
      const previous = pages[index - 1];
      const pageToken = { key: `page-${candidate}`, page: candidate };

      return previous !== undefined && candidate - previous > 1
        ? [{ key: `gap-${previous}-${candidate}`, page: null }, pageToken]
        : [pageToken];
    });
  }

  pageLabel(page: number): string {
    return page === this.metadata.page ? `Page ${page}, current page` : `Page ${page}`;
  }

  requestPage(page: number): void {
    if (
      this.disabled ||
      page === this.metadata.page ||
      page < 1 ||
      page > this.metadata.totalPages
    ) {
      return;
    }

    this.pageChange.emit(page);
  }

  requestPageSize(value: string): void {
    const pageSize = workItemPageSizes.find((candidate) => String(candidate) === value);

    if (
      !this.disabled &&
      pageSize !== undefined &&
      pageSize !== this.metadata.pageSize
    ) {
      this.pageSizeChange.emit(pageSize);
    }
  }
}
