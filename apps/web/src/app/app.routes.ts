import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'my-work'
  },
  {
    path: 'my-work',
    loadComponent: () =>
      import('./features/my-work/my-work-page.component').then(
        (module) => module.MyWorkPageComponent
      ),
    title: 'My Work | Worktrail'
  },
  {
    path: 'inbox',
    loadComponent: () =>
      import('./features/inbox/inbox-page.component').then((module) => module.InboxPageComponent),
    title: 'Inbox | Worktrail'
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/projects/project-list-page.component').then(
        (module) => module.ProjectListPageComponent
      ),
    title: 'Projects | Worktrail'
  },
  {
    path: 'portfolio',
    loadComponent: () =>
      import('./features/portfolio/portfolio-page.component').then(
        (module) => module.PortfolioPageComponent
      ),
    title: 'Portfolio | Worktrail'
  },
  {
    path: 'workspace/settings',
    loadComponent: () =>
      import('./features/workspace/workspace-settings-page.component').then(
        (module) => module.WorkspaceSettingsPageComponent
      ),
    title: 'Workspace Settings | Worktrail'
  },
  {
    path: 'projects/:projectId',
    loadComponent: () =>
      import('./features/projects/project-shell/project-shell.component').then(
        (module) => module.ProjectShellComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/projects/project-home-page.component').then(
            (module) => module.ProjectHomePageComponent
          ),
        title: 'Project | Worktrail'
      },
      {
        path: 'work-items/new',
        loadComponent: () =>
          import('./features/work-items/work-item-create-page.component').then(
            (module) => module.WorkItemCreatePageComponent
          ),
        title: 'Create Work Item | Worktrail'
      },
      {
        path: 'work-items/import',
        loadComponent: () =>
          import('./features/work-items/work-item-import-page.component').then(
            (module) => module.WorkItemImportPageComponent
          ),
        title: 'Import Work Items | Worktrail'
      },
      {
        path: 'work-items',
        loadComponent: () =>
          import('./features/work-items/work-item-list-page.component').then(
            (module) => module.WorkItemListPageComponent
          ),
        title: 'Work Items | Worktrail'
      },
      {
        path: 'board',
        loadComponent: () =>
          import('./features/work-items/work-item-board-page.component').then(
            (module) => module.WorkItemBoardPageComponent
          ),
        title: 'Board | Worktrail'
      },
      {
        path: 'planning',
        loadComponent: () =>
          import('./features/projects/project-planning-page.component').then(
            (module) => module.ProjectPlanningPageComponent
          ),
        title: 'Planning | Worktrail'
      },
      {
        path: 'status',
        loadComponent: () =>
          import('./features/projects/status-reports/project-status-report-list-page.component').then(
            (module) => module.ProjectStatusReportListPageComponent
          ),
        title: 'Reports | Worktrail'
      },
      {
        path: 'status/new',
        loadComponent: () =>
          import('./features/projects/status-reports/project-status-report-draft-page.component').then(
            (module) => module.ProjectStatusReportDraftPageComponent
          ),
        title: 'New Report | Worktrail'
      },
      {
        path: 'status/:reportId',
        loadComponent: () =>
          import('./features/projects/status-reports/project-status-report-detail-page.component').then(
            (module) => module.ProjectStatusReportDetailPageComponent
          ),
        title: 'Report | Worktrail'
      },
      {
        path: 'milestones/:milestoneId',
        loadComponent: () =>
          import('./features/projects/project-milestone-review-page.component').then(
            (module) => module.ProjectMilestoneReviewPageComponent
          ),
        title: 'Milestone Review | Worktrail'
      },
      {
        path: 'cycles/:cycleId',
        loadComponent: () =>
          import('./features/projects/project-cycle-review-page.component').then(
            (module) => module.ProjectCycleReviewPageComponent
          ),
        title: 'Cycle Review | Worktrail'
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/projects/project-settings-page.component').then(
            (module) => module.ProjectSettingsPageComponent
          ),
        title: 'Project Settings | Worktrail'
      }
    ]
  },
  {
    path: 'work-items/new',
    loadComponent: () =>
      import('./features/work-items/work-item-create-page.component').then(
        (module) => module.WorkItemCreatePageComponent
      ),
    title: 'Create Work Item | Worktrail'
  },
  {
    path: 'work-items',
    loadComponent: () =>
      import('./features/work-items/workspace-work-item-list-page.component').then(
        (module) => module.WorkspaceWorkItemListPageComponent
      ),
    title: 'Work Items | Worktrail'
  },
  {
    path: 'work-items/:workItemId',
    loadComponent: () =>
      import('./features/work-items/work-item-detail-page.component').then(
        (module) => module.WorkItemDetailPageComponent
      ),
    title: 'Work Item | Worktrail'
  },
  {
    path: '**',
    redirectTo: 'my-work'
  }
];
