import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CurrentUserService } from './core/current-user.service';
import { ErrorPanelComponent } from './shared/ui/error-panel.component';
import { LoadingIndicatorComponent } from './shared/ui/loading-indicator.component';

@Component({
  selector: 'app-root',
  imports: [
    ErrorPanelComponent,
    FormsModule,
    LoadingIndicatorComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  readonly currentUser = inject(CurrentUserService);

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.currentUser.loadMembers();
  }

  selectMember(memberId: string): void {
    this.currentUser.selectMember(memberId);
  }
}
