import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { SavedWorkViewDto } from '@worktrail/contracts';

@Component({
  selector: 'app-pinned-saved-views',
  template: `
    @if (hasPinnedViews) {
      <section class="pinned-views" aria-labelledby="pinned-views-heading">
        <div class="pinned-views__heading">
          <h2 id="pinned-views-heading">{{ heading }}</h2>
          <p>{{ sortedSharedViews.length }} shared · {{ sortedPersonalViews.length }} personal</p>
        </div>

        <div class="pinned-views__list" aria-label="Pinned saved view shortcuts">
          @for (view of sortedSharedViews; track view.id) {
            <button
              type="button"
              class="pinned-view"
              [attr.aria-label]="'Open pinned shared view ' + view.name"
              (click)="open.emit(view)"
            >
              <span class="pinned-view__name">{{ view.name }}</span>
              <span class="pinned-view__badge pinned-view__badge--shared">Shared</span>
            </button>
          }

          @for (view of sortedPersonalViews; track view.id) {
            <button
              type="button"
              class="pinned-view"
              [attr.aria-label]="'Open pinned personal view ' + view.name"
              (click)="open.emit(view)"
            >
              <span class="pinned-view__name">{{ view.name }}</span>
              <span class="pinned-view__badge">Personal</span>
            </button>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .pinned-views {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
    }

    .pinned-views__heading {
      display: flex;
      gap: 12px;
      align-items: end;
      justify-content: space-between;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      color: #111827;
      font-size: 0.92rem;
      line-height: 1.2;
    }

    p {
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .pinned-views__list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .pinned-view {
      display: inline-flex;
      min-height: 38px;
      max-width: 280px;
      align-items: center;
      gap: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 10px;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 800;
      line-height: 1.2;
      text-align: left;
      transition:
        border-color 120ms ease,
        box-shadow 120ms ease;
    }

    .pinned-view:hover {
      border-color: #2563eb;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
    }

    .pinned-view:focus-visible {
      outline: 3px solid rgba(37, 99, 235, 0.28);
      outline-offset: 2px;
    }

    .pinned-view__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pinned-view__badge {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 2px 6px;
      background: #ecfdf5;
      color: #047857;
      font-size: 0.68rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .pinned-view__badge--shared {
      background: #eff6ff;
      color: #1d4ed8;
    }
  `
})
export class PinnedSavedViewsComponent {
  @Input() heading = 'Pinned views';
  @Input() sharedViews: SavedWorkViewDto[] = [];
  @Input() personalViews: SavedWorkViewDto[] = [];

  @Output() readonly open = new EventEmitter<SavedWorkViewDto>();

  get sortedSharedViews(): SavedWorkViewDto[] {
    return this.sortViews(this.sharedViews);
  }

  get sortedPersonalViews(): SavedWorkViewDto[] {
    return this.sortViews(this.personalViews);
  }

  get hasPinnedViews(): boolean {
    return this.sharedViews.length > 0 || this.personalViews.length > 0;
  }

  private sortViews(views: SavedWorkViewDto[]): SavedWorkViewDto[] {
    return [...views].sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      return byName === 0 ? left.id.localeCompare(right.id) : byName;
    });
  }
}
