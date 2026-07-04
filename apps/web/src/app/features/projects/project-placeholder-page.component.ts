import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-project-placeholder-page',
  imports: [RouterLink],
  template: `
    <section class="page-heading">
      <p class="eyebrow">{{ label() }}</p>
      <h1>{{ heading() }}</h1>
      <p>Project ID: <code>{{ projectId() }}</code></p>
    </section>

    <nav class="subnav" aria-label="Project sections">
      <a [routerLink]="['/projects', projectId()]">Home</a>
      <a [routerLink]="['/projects', projectId(), 'work-items']">Work items</a>
      <a [routerLink]="['/projects', projectId(), 'board']">Board</a>
      <a [routerLink]="['/projects', projectId(), 'planning']">Planning</a>
    </nav>

    <section class="readiness-panel">
      <h2>Route ready</h2>
      <p>
        This screen is registered and parameterized. Feature implementation lands in the project
        and work item phases.
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

    .subnav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }

    .subnav a {
      min-height: 34px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 12px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    .subnav a:hover {
      border-color: #94a3b8;
      background: #f8fafc;
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
export class ProjectPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
  readonly label = computed(() => this.route.snapshot.data['label'] as string);
  readonly heading = computed(() => this.route.snapshot.data['heading'] as string);
}
