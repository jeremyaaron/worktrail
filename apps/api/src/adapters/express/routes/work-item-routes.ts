import type { Express } from 'express';

import { listWorkItemActivityHandler } from '../../../endpoints/activity.js';
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
  updateCommentHandler
} from '../../../endpoints/comments.js';
import {
  applyWorkItemCsvImportHandler,
  bulkUpdateWorkItemsHandler,
  createWorkItemHandler,
  createWorkItemRelationshipHandler,
  deleteWorkItemRelationshipHandler,
  exportProjectWorkItemsHandler,
  exportWorkspaceWorkItemsHandler,
  getWorkItemHandler,
  getWorkItemWatchStateHandler,
  listWorkItemRelationshipsHandler,
  listWorkspaceWorkItemsHandler,
  listWorkItemsHandler,
  moveWorkItemOnBoardHandler,
  previewWorkItemCsvImportHandler,
  transitionWorkItemHandler,
  updateWorkItemHandler,
  unwatchWorkItemHandler,
  watchWorkItemHandler
} from '../../../endpoints/work-items.js';
import { adaptEndpoint } from '../handler-adapter.js';
import { adapterOptions, type ExpressRouteContext } from './context.js';

export function registerWorkItemRoutes(app: Express, context: ExpressRouteContext): void {
  const options = adapterOptions(context);

  app.get(
    '/api/work-items',
    adaptEndpoint(
      listWorkspaceWorkItemsHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/work-items/export',
    adaptEndpoint(exportWorkspaceWorkItemsHandler({ repositories: context.repositories }), options)
  );
  app.get(
    '/api/projects/:projectId/work-items',
    adaptEndpoint(listWorkItemsHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/projects/:projectId/work-items/export',
    adaptEndpoint(exportProjectWorkItemsHandler({ repositories: context.repositories }), options)
  );
  app.post(
    '/api/projects/:projectId/work-items/imports/preview',
    adaptEndpoint(
      previewWorkItemCsvImportHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/work-items/imports',
    adaptEndpoint(
      applyWorkItemCsvImportHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.post(
    '/api/projects/:projectId/work-items/bulk-update',
    adaptEndpoint(bulkUpdateWorkItemsHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/projects/:projectId/work-items',
    adaptEndpoint(createWorkItemHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/work-items/:workItemId/comments',
    adaptEndpoint(listCommentsHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/work-items/:workItemId/comments',
    adaptEndpoint(createCommentHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.patch(
    '/api/comments/:commentId',
    adaptEndpoint(updateCommentHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.delete(
    '/api/comments/:commentId',
    adaptEndpoint(deleteCommentHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.get(
    '/api/work-items/:workItemId/activity',
    adaptEndpoint(listWorkItemActivityHandler(context.repositories), options)
  );
  app.get(
    '/api/work-items/:workItemId/relationships',
    adaptEndpoint(
      listWorkItemRelationshipsHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/work-items/:workItemId/watchers',
    adaptEndpoint(getWorkItemWatchStateHandler({ repositories: context.repositories }), options)
  );
  app.put(
    '/api/work-items/:workItemId/watch',
    adaptEndpoint(watchWorkItemHandler({ repositories: context.repositories }), options)
  );
  app.delete(
    '/api/work-items/:workItemId/watch',
    adaptEndpoint(unwatchWorkItemHandler({ repositories: context.repositories }), options)
  );
  app.post(
    '/api/work-items/:workItemId/relationships',
    adaptEndpoint(
      createWorkItemRelationshipHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.delete(
    '/api/work-items/:workItemId/relationships/:relationshipId',
    adaptEndpoint(
      deleteWorkItemRelationshipHandler({ repositories: context.repositories, db: context.db }),
      options
    )
  );
  app.get(
    '/api/work-items/:workItemId',
    adaptEndpoint(getWorkItemHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.patch(
    '/api/work-items/:workItemId',
    adaptEndpoint(updateWorkItemHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/work-items/:workItemId/transitions',
    adaptEndpoint(transitionWorkItemHandler({ repositories: context.repositories, db: context.db }), options)
  );
  app.post(
    '/api/work-items/:workItemId/board-move',
    adaptEndpoint(moveWorkItemOnBoardHandler({ repositories: context.repositories, db: context.db }), options)
  );
}
