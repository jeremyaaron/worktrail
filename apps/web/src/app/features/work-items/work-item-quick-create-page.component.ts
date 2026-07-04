import { Component } from '@angular/core';

@Component({
  selector: 'app-work-item-quick-create-page',
  template: `
    <section class="page-heading">
      <p class="eyebrow">Create</p>
      <h1>Create work item</h1>
      <p>Workspace-level quick capture is next in the v0.0.5 build.</p>
    </section>

    <section class="readiness-panel">
      <h2>Quick create route ready</h2>
      <p>The global create route is registered while project selection behavior is implemented.</p>
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
export class WorkItemQuickCreatePageComponent {}
