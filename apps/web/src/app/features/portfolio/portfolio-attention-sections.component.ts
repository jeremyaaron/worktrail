import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  PortfolioAttentionItemDto,
  PortfolioAttentionSectionsDto,
  PortfolioLinkDto
} from '@worktrail/contracts';

import { portfolioLinkQueryParams, severityTone } from './portfolio-display';

interface AttentionSection {
  key: keyof PortfolioAttentionSectionsDto;
  title: string;
  empty: string;
  items: PortfolioAttentionItemDto[];
}

@Component({
  selector: 'app-portfolio-attention-sections',
  imports: [RouterLink],
  template: `
    <section class="attention-grid" aria-label="Portfolio attention sections">
      @for (section of sections(); track section.key) {
        <section class="attention-section" [attr.aria-labelledby]="section.key + '-heading'">
          <div class="section-heading">
            <h2 [id]="section.key + '-heading'">{{ section.title }}</h2>
            <span>{{ section.items.length }}</span>
          </div>

          @if (section.items.length === 0) {
            <p class="empty">{{ section.empty }}</p>
          } @else {
            <div class="attention-list">
              @for (item of section.items; track item.type + item.project.id + item.title) {
                <article class="attention-card" [attr.data-tone]="severityTone(item.severity)">
                  <div>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.project.name }}</span>
                  </div>
                  <p>{{ item.message }}</p>
                  <a [routerLink]="item.link.route" [queryParams]="linkQueryParams(item.link)">
                    {{ item.link.label }}
                  </a>
                </article>
              }
            </div>
          }
        </section>
      }
    </section>
  `,
  styles: `
    .attention-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .attention-section {
      min-width: 0;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #ffffff;
    }

    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid #e5edf6;
      padding: 12px;
    }

    h2 {
      margin: 0;
      color: #111827;
      font-size: 0.95rem;
      line-height: 1.3;
    }

    .section-heading span {
      display: inline-grid;
      min-width: 24px;
      min-height: 24px;
      place-items: center;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .empty {
      margin: 0;
      padding: 14px 12px;
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.45;
    }

    .attention-list {
      display: grid;
    }

    .attention-card {
      display: grid;
      gap: 8px;
      border-left: 3px solid #94a3b8;
      border-bottom: 1px solid #edf2f7;
      padding: 12px;
    }

    .attention-card:last-child {
      border-bottom: 0;
    }

    .attention-card[data-tone='warning'] {
      border-left-color: #d97706;
    }

    .attention-card[data-tone='critical'] {
      border-left-color: #dc2626;
    }

    .attention-card[data-tone='info'] {
      border-left-color: #2563eb;
    }

    strong,
    a {
      color: #111827;
      font-weight: 800;
      line-height: 1.3;
    }

    span,
    p {
      color: #52637a;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    p {
      margin: 0;
    }

    a {
      width: fit-content;
      color: #1d4ed8;
      font-size: 0.84rem;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    @media (max-width: 1200px) {
      .attention-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .attention-grid {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class PortfolioAttentionSectionsComponent {
  readonly attention = input.required<PortfolioAttentionSectionsDto>();

  protected readonly severityTone = severityTone;

  sections(): AttentionSection[] {
    const attention = this.attention();

    return [
      {
        key: 'needsAttention',
        title: 'Needs attention',
        empty: 'No project delivery risks are currently elevated.',
        items: attention.needsAttention
      },
      {
        key: 'communicationFreshness',
        title: 'Communication freshness',
        empty: 'Recent reports are available for active projects.',
        items: attention.communicationFreshness
      },
      {
        key: 'currentExecution',
        title: 'Current execution',
        empty: 'No active cycle or milestone context is currently highlighted.',
        items: attention.currentExecution
      },
      {
        key: 'dependencyPressure',
        title: 'Dependency pressure',
        empty: 'No dependency pressure needs review right now.',
        items: attention.dependencyPressure
      }
    ];
  }

  linkQueryParams(link: PortfolioLinkDto): Record<string, string> | null {
    return portfolioLinkQueryParams(link);
  }
}
