import type { Express } from 'express';

import { listProjectActivityHandler } from '../../../endpoints/activity.js';
import {
  archiveLabelHandler,
  createLabelHandler,
  listProjectLabelsHandler,
  reactivateLabelHandler,
  updateLabelHandler
} from '../../../endpoints/labels.js';
import {
  archiveMilestoneHandler,
  createMilestoneHandler,
  listProjectMilestonesHandler,
  reactivateMilestoneHandler,
  updateMilestoneHandler
} from '../../../endpoints/milestones.js';
import {
  archiveProjectHandler,
  createProjectHandler,
  getProjectHandler,
  getProjectSummaryHandler,
  listProjectNavigationSummariesHandler,
  listProjectsHandler,
  reactivateProjectHandler,
  updateProjectHandler
} from '../../../endpoints/projects.js';
import {
  getProjectStatusReportDraftHandler,
  getProjectStatusReportHandler,
  listProjectStatusReportsHandler,
  publishProjectStatusReportHandler
} from '../../../endpoints/status-reports.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerProjectRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get('/api/projects', adaptEndpoint(listProjectsHandler(context.repositories), options));
  app.get(
    '/api/projects/navigation-summary',
    adaptEndpoint(listProjectNavigationSummariesHandler(context.repositories), options)
  );
  app.post(
    '/api/projects',
    adaptEndpoint(createProjectHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/projects/:projectId/summary',
    adaptEndpoint(getProjectSummaryHandler(context.repositories), options)
  );
  app.get(
    '/api/projects/:projectId/activity',
    adaptEndpoint(listProjectActivityHandler(context.repositories), options)
  );
  app.get(
    '/api/projects/:projectId/labels',
    adaptEndpoint(listProjectLabelsHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/projects/:projectId/labels',
    adaptEndpoint(createLabelHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/projects/:projectId/milestones',
    adaptEndpoint(listProjectMilestonesHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/projects/:projectId/milestones',
    adaptEndpoint(createMilestoneHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/projects/:projectId/status-reports',
    adaptEndpoint(
      listProjectStatusReportsHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/projects/:projectId/status-reports/draft',
    adaptEndpoint(
      getProjectStatusReportDraftHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/status-reports',
    adaptEndpoint(
      publishProjectStatusReportHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/projects/:projectId/status-reports/:reportId',
    adaptEndpoint(
      getProjectStatusReportHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/archive',
    adaptEndpoint(archiveProjectHandler(context.repositories), options)
  );
  app.post(
    '/api/projects/:projectId/reactivate',
    adaptEndpoint(reactivateProjectHandler(context.repositories), options)
  );
  app.get('/api/projects/:projectId', adaptEndpoint(getProjectHandler(context.repositories), options));
  app.patch(
    '/api/projects/:projectId',
    adaptEndpoint(updateProjectHandler(context.repositories), options)
  );
  app.patch(
    '/api/labels/:labelId',
    adaptEndpoint(updateLabelHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.patch(
    '/api/milestones/:milestoneId',
    adaptEndpoint(updateMilestoneHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/labels/:labelId/archive',
    adaptEndpoint(archiveLabelHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/milestones/:milestoneId/archive',
    adaptEndpoint(archiveMilestoneHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/labels/:labelId/reactivate',
    adaptEndpoint(reactivateLabelHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/milestones/:milestoneId/reactivate',
    adaptEndpoint(reactivateMilestoneHandler({ repositories: context.repositories, db: context.db }), options)
  );
}
