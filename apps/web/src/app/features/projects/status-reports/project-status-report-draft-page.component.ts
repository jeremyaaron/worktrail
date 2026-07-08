import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-project-status-report-draft-page',
  imports: [RouterLink],
  template: `
    <section class="status-page">
      <div class="status-page__heading">
        <div>
          <p class="status-page__eyebrow">Status reports</p>
          <h1>New status report</h1>
        </div>
        <a [routerLink]="['/projects', projectId(), 'status']">Back to status</a>
      </div>

      <section class="status-page__panel">
        <h2>Route ready</h2>
        <p>Draft generation and publish controls will be implemented in the draft phase.</p>
      </section>
    </section>
  `,
  styles: `
    .status-page,
    .status-page__panel {
      display: grid;
      gap: 14px;
    }

    .status-page__heading {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .status-page__eyebrow,
    h1,
    h2,
    p {
      margin: 0;
    }

    .status-page__eyebrow {
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      color: #111827;
      font-size: 1.5rem;
      line-height: 1.2;
    }

    h2 {
      color: #111827;
      font-size: 1rem;
      line-height: 1.35;
    }

    p {
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 12px;
      background: #ffffff;
      color: #1e3a5f;
      font-size: 0.875rem;
      font-weight: 800;
      text-decoration: none;
    }

    .status-page__panel {
      border: 1px solid #d7e0ea;
      border-radius: 8px;
      padding: 18px;
      background: #ffffff;
    }
  `
})
export class ProjectStatusReportDraftPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = computed(() => this.route.snapshot.paramMap.get('projectId') ?? '');
}
