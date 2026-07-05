import { Component } from '@angular/core';

@Component({
  selector: 'app-milestone-manager',
  template: `
    <section class="milestone-manager">
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .milestone-manager {
      display: block;
    }
  `
})
export class MilestoneManagerComponent {}
