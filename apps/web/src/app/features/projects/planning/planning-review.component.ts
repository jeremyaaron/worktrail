import { Component } from '@angular/core';

@Component({
  selector: 'app-planning-review',
  template: `
    <section class="planning-review">
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .planning-review {
      display: block;
    }
  `
})
export class PlanningReviewComponent {}
