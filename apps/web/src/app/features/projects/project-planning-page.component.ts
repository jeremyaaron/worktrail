import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-project-planning-page',
  imports: [RouterLink],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Planning</p>
        <h1>Project planning</h1>
        <p>Milestones and planning signals will land here as the v0.0.3 UI phases continue.</p>
      </div>

      <nav aria-label="Project navigation">
        <a [routerLink]="['/projects', projectId()]">Overview</a>
        <a [routerLink]="['/projects', projectId(), 'work-items']">Work items</a>
        <a [routerLink]="['/projects', projectId(), 'board']">Board</a>
        <a [routerLink]="['/projects', projectId(), 'settings']">Settings</a>
      </nav>
    </section>

    <section class="planning-grid" aria-label="Planning sections">
      <article>
        <h2>Milestones</h2>
        <p>Milestone management will be added to this route in Phase 7.</p>
      </article>

      <article>
        <h2>Planning summary</h2>
        <p>Risk lists and progress signals will be added to this route in Phase 10.</p>
      </article>
    </section>
  `,
  styles: `
    .page-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
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

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    nav a {
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 700;
      text-decoration: none;
    }

    nav a:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .planning-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    article {
      min-height: 140px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }

    h2 {
      margin: 0 0 8px;
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    @media (max-width: 760px) {
      .page-header,
      .planning-grid {
        grid-template-columns: 1fr;
      }

      nav {
        justify-content: flex-start;
      }
    }
  `
})
export class ProjectPlanningPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
}
