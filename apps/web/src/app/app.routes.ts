import { Routes } from '@angular/router';

import { ProjectHomePageComponent } from './features/projects/project-home-page.component';
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
    path: 'projects/:projectId/work-items/new',
    component: ProjectPlaceholderPageComponent,
    title: 'Create Work Item | Worktrail',
    data: {
      label: 'Create work item',
      heading: 'Create work item'
    }
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
    component: ProjectHomePageComponent,
    title: 'Project | Worktrail'
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
