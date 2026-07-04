import { Routes } from '@angular/router';

import { ProjectHomePageComponent } from './features/projects/project-home-page.component';
import { ProjectListPageComponent } from './features/projects/project-list-page.component';
import { ProjectPlanningPageComponent } from './features/projects/project-planning-page.component';
import { ProjectSettingsPageComponent } from './features/projects/project-settings-page.component';
import { WorkItemBoardPageComponent } from './features/work-items/work-item-board-page.component';
import { WorkItemCreatePageComponent } from './features/work-items/work-item-create-page.component';
import { WorkItemDetailPageComponent } from './features/work-items/work-item-detail-page.component';
import { WorkItemListPageComponent } from './features/work-items/work-item-list-page.component';

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
    component: WorkItemCreatePageComponent,
    title: 'Create Work Item | Worktrail'
  },
  {
    path: 'projects/:projectId/work-items',
    component: WorkItemListPageComponent,
    title: 'Work Items | Worktrail'
  },
  {
    path: 'projects/:projectId/board',
    component: WorkItemBoardPageComponent,
    title: 'Board | Worktrail'
  },
  {
    path: 'projects/:projectId/planning',
    component: ProjectPlanningPageComponent,
    title: 'Planning | Worktrail'
  },
  {
    path: 'projects/:projectId/settings',
    component: ProjectSettingsPageComponent,
    title: 'Project Settings | Worktrail'
  },
  {
    path: 'projects/:projectId',
    component: ProjectHomePageComponent,
    title: 'Project | Worktrail'
  },
  {
    path: 'work-items/:workItemId',
    component: WorkItemDetailPageComponent,
    title: 'Work Item | Worktrail'
  },
  {
    path: '**',
    redirectTo: 'projects'
  }
];
