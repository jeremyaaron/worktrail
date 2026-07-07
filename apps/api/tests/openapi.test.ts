import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const openApiPath = fileURLToPath(new URL('../../../docs/api/openapi.yaml', import.meta.url));

describe('OpenAPI reference', () => {
  it('documents key implemented API paths and local development behavior', async () => {
    const openApi = await readFile(openApiPath, 'utf8');

    const requiredPaths = [
      '/api/health',
      '/api/health/live',
      '/api/health/ready',
      '/api/workspace',
      '/api/workspace/capabilities',
      '/api/workspace/activity',
      '/api/members',
      '/api/members/{memberId}',
      '/api/members/{memberId}/deactivate',
      '/api/members/{memberId}/reactivate',
      '/api/notifications',
      '/api/notifications/unread-count',
      '/api/notifications/{notificationId}',
      '/api/notifications/mark-all-read',
      '/api/projects',
      '/api/projects/navigation-summary',
      '/api/projects/{projectId}',
      '/api/projects/{projectId}/summary',
      '/api/projects/{projectId}/planning-summary',
      '/api/projects/{projectId}/activity',
      '/api/projects/{projectId}/archive',
      '/api/projects/{projectId}/reactivate',
      '/api/projects/{projectId}/labels',
      '/api/labels/{labelId}',
      '/api/labels/{labelId}/archive',
      '/api/labels/{labelId}/reactivate',
      '/api/projects/{projectId}/milestones',
      '/api/milestones/{milestoneId}',
      '/api/milestones/{milestoneId}/archive',
      '/api/milestones/{milestoneId}/reactivate',
      '/api/work-items',
      '/api/work-items/export',
      '/api/projects/{projectId}/work-items',
      '/api/projects/{projectId}/work-items/imports/preview',
      '/api/projects/{projectId}/work-items/imports',
      '/api/projects/{projectId}/work-items/export',
      '/api/work-items/{workItemId}',
      '/api/work-items/{workItemId}/transitions',
      '/api/work-items/{workItemId}/board-move',
      '/api/work-items/{workItemId}/watchers',
      '/api/work-items/{workItemId}/watch',
      '/api/work-items/{workItemId}/comments',
      '/api/comments/{commentId}',
      '/api/work-items/{workItemId}/activity',
      '/api/work-items/{workItemId}/relationships',
      '/api/work-items/{workItemId}/relationships/{relationshipId}',
      '/api/my-work',
      '/api/saved-work-views',
      '/api/saved-work-views/{savedViewId}'
    ];

    for (const path of requiredPaths) {
      expect(openApi, `missing ${path}`).toContain(`  ${path}:`);
    }

    expect(openApi).toContain('x-worktrail-member-id');
    expect(openApi).toContain('x-worktrail-workspace-id');
    expect(openApi).toContain('x-worktrail-role');
    expect(openApi).toContain('ErrorResponse:');
    expect(openApi).toContain('WorkItemCsvImportPreviewRequest:');
    expect(openApi).toContain('WorkItemCsvImportApplyRequest:');
    expect(openApi).toContain('WorkItemCsvImportPreview:');
    expect(openApi).toContain('WorkItemCsvImportApply:');
    expect(openApi).toContain('WorkItemRelationshipType:');
    expect(openApi).toContain('DependencyFilter:');
    expect(openApi).toContain('WorkItemRelationshipSummary:');
    expect(openApi).toContain('CreateWorkItemRelationshipRequest:');
    expect(openApi).toContain('WorkItemRelationship:');
    expect(openApi).toContain('NotificationType:');
    expect(openApi).toContain('NotificationListResponse:');
    expect(openApi).toContain('NotificationUnreadCountResponse:');
    expect(openApi).toContain('UpdateNotificationReadStateRequest:');
    expect(openApi).toContain('WorkItemWatcher:');
    expect(openApi).toContain('WorkItemWatchState:');
    expect(openApi).toContain('mentionMemberIds:');
    expect(openApi).toContain('mentions:');
    expect(openApi).toContain('DeliveryHealthState:');
    expect(openApi).toContain('DeliveryHealthSeverity:');
    expect(openApi).toContain('DeliveryHealthReasonKey:');
    expect(openApi).toContain('DeliveryHealthReason:');
    expect(openApi).toContain('ProjectDeliveryHealth:');
    expect(openApi).toContain('MilestoneProgress:');
    expect(openApi).toContain('PlanningReviewItemKind:');
    expect(openApi).toContain('PlanningReviewItem:');
    expect(openApi).toContain('PlanningReview:');
    expect(openApi).toContain('deliveryHealth:');
    expect(openApi).toContain('planningReview:');
    expect(openApi).toContain('SavedWorkViewVisibility:');
    expect(openApi).toContain('SavedWorkViewScope:');
    expect(openApi).toContain('enum: [personal, workspace]');
    expect(openApi).toContain('enum: [workspace, project]');
    expect(openApi).toContain('SavedViewScopeQuery:');
    expect(openApi).toContain('SavedViewProjectIdQuery:');
    expect(openApi).toContain('Use `scope=project` with `projectId` to list views saved for one active or archived project.');
    expect(openApi).toContain('New saved views are created unpinned.');
    expect(openApi).toContain('Creating a shared saved view requires owner or maintainer role.');
    expect(openApi).toContain('isPinned:');
    expect(openApi).toContain('Pin or unpin the saved view without changing its name, query, scope, project, or visibility.');
    expect(openApi).toContain('Archived project-scoped saved views cannot be mutated.');
    expect(openApi).toContain('saved_view.created');
    expect(openApi).toContain('saved_view.updated');
    expect(openApi).toContain('saved_view.pinned');
    expect(openApi).toContain('saved_view.unpinned');
    expect(openApi).toContain('unmilestoned_risk');
    expect(openApi).toContain('target_date_past');
    expect(openApi).toContain('dependency_blocked');
    expect(openApi).toContain('blocking_open_work');
    expect(openApi).toContain('work_item.relationship_added');
    expect(openApi).toContain('work_item.relationship_removed');
    expect(openApi).toContain('text/csv:');
    expect(openApi).toContain('VALIDATION_ERROR');
    expect(openApi).toContain('INTERNAL_ERROR');
  });
});
