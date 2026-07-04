import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-work-item-placeholder-page',
  template: `
    <section class="page-heading">
      <p class="eyebrow">Work item</p>
      <h1>Work item detail</h1>
      <p>Work item ID: <code>{{ workItemId() }}</code></p>
    </section>

    <section class="readiness-panel">
      <h2>Detail route ready</h2>
      <p>
        The detail route is available for the later detail, comments, and activity timeline
        implementation.
      </p>
    </section>
  `,
  styles: `
    .page-heading {
      margin-bottom: 20px;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 8px;
      color: #111827;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    p {
      margin: 0;
      color: #64748b;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    code {
      color: #334155;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.8125rem;
      overflow-wrap: anywhere;
    }

    .readiness-panel {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    .readiness-panel h2 {
      margin: 0 0 6px;
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }
  `
})
export class WorkItemPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly workItemId = computed(() => this.route.snapshot.paramMap.get('workItemId') ?? '');
}
