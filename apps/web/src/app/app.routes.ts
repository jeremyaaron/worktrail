import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projects'
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
    path: 'workspace/settings',
    loadComponent: () =>
      import('./features/workspace/workspace-settings-page.component').then(
        (module) => module.WorkspaceSettingsPageComponent
      ),
    title: 'Workspace Settings | Worktrail'
  },
  {
    path: 'projects/:projectId/work-items/new',
    loadComponent: () =>
      import('./features/work-items/work-item-create-page.component').then(
        (module) => module.WorkItemCreatePageComponent
      ),
    title: 'Create Work Item | Worktrail'
  },
  {
    path: 'projects/:projectId/work-items',
    loadComponent: () =>
      import('./features/work-items/work-item-list-page.component').then(
        (module) => module.WorkItemListPageComponent
      ),
    title: 'Work Items | Worktrail'
  },
  {
    path: 'projects/:projectId/board',
    loadComponent: () =>
      import('./features/work-items/work-item-board-page.component').then(
        (module) => module.WorkItemBoardPageComponent
      ),
    title: 'Board | Worktrail'
  },
  {
    path: 'projects/:projectId/planning',
    loadComponent: () =>
      import('./features/projects/project-planning-page.component').then(
        (module) => module.ProjectPlanningPageComponent
      ),
    title: 'Planning | Worktrail'
  },
  {
    path: 'projects/:projectId/settings',
    loadComponent: () =>
      import('./features/projects/project-settings-page.component').then(
        (module) => module.ProjectSettingsPageComponent
      ),
    title: 'Project Settings | Worktrail'
  },
  {
    path: 'projects/:projectId',
    loadComponent: () =>
      import('./features/projects/project-home-page.component').then(
        (module) => module.ProjectHomePageComponent
      ),
    title: 'Project | Worktrail'
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
    redirectTo: 'projects'
  }
];
