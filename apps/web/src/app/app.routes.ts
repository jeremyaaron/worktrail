import { Routes } from '@angular/router';

import { ProjectListPageComponent } from './features/projects/project-list-page.component';
import { ProjectPlaceholderPageComponent } from './features/projects/project-placeholder-page.component';
import { WorkItemPlaceholderPageComponent } from './features/work-items/work-item-placeholder-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projects'
  },
  {
    path: 'projects',
    component: ProjectListPageComponent,
    title: 'Projects | Worktrail'
  },
  {
    path: 'projects/:projectId/work-items',
    component: ProjectPlaceholderPageComponent,
    title: 'Work Items | Worktrail',
    data: {
      label: 'Work items',
      heading: 'Project work items'
    }
  },
  {
    path: 'projects/:projectId/board',
    component: ProjectPlaceholderPageComponent,
    title: 'Board | Worktrail',
    data: {
      label: 'Board',
      heading: 'Project board'
    }
  },
  {
    path: 'projects/:projectId',
    component: ProjectPlaceholderPageComponent,
    title: 'Project | Worktrail',
    data: {
      label: 'Project',
      heading: 'Project home'
    }
  },
  {
    path: 'work-items/:workItemId',
    component: WorkItemPlaceholderPageComponent,
    title: 'Work Item | Worktrail'
  },
  {
    path: '**',
    redirectTo: 'projects'
  }
];
