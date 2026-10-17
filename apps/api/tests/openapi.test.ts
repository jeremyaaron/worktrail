import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { csvImportPaths, jsonBodyLimits } from '../src/adapters/express/body-parsing.js';

const openApiPath = fileURLToPath(new URL('../../../docs/api/openapi.yaml', import.meta.url));

describe('OpenAPI reference', () => {
  it('documents the implemented import/ordinary transport budgets and safe parser errors', async () => {
    const openApi = await readFile(openApiPath, 'utf8');
    expect(openApi).toContain(jsonBodyLimits.ordinary.toLocaleString('en-US') + '-byte (100 KiB)');
    for (const path of Object.values(csvImportPaths)) {
      const documentPath = path.replace(':projectId', '{projectId}');
      const operation = openApi.split(`  ${documentPath}:\n`)[1]?.split('\n  /api/')[0];
      expect(operation).toContain(jsonBodyLimits.csvImport.toLocaleString('en-US') + ' bytes');
      expect(operation).toContain('1,048,576');
      expect(operation).toContain('250 data rows');
      for (const status of ['400', '413', '415']) expect(operation).toContain(`"${status}":`);
      expect(operation).toContain('PAYLOAD_TOO_LARGE');
      expect(operation).toContain('VALIDATION_ERROR');
    }
    expect(openApi).toContain('rejected without inflation');
    expect(openApi).toContain('independent application/octet-stream boundary and 4 MiB file limit');
  });

  it('documents format-aware CSV import and bounded source previews without changing exports', async () => {
    const openApi = await readFile(openApiPath, 'utf8');
    const requestSchema = openApi.split('    WorkItemCsvImportPreviewRequest:\n')[1]?.split('    WorkItemCsvImportApplyRequest:')[0];
    const row = openApi.split('    WorkItemCsvImportPreviewRow:\n')[1]?.split('    WorkItemCsvImportPreview:')[0];
    expect(requestSchema).toContain('description_format');
    expect(requestSchema).toContain('missing/blank values default to plain_text');
    expect(requestSchema).toContain('10,000 normalized UTF-16 code units');
    expect(row).toContain('- descriptionFormat');
    expect(row).toContain('- descriptionExcerpt');
    expect(row).toContain('maxLength: 240');
    expect(row).toContain('not HTML or Markdown');
    expect(openApi).toContain('not round-trip import documents');
  });

  it('documents comment write formats, required source, legacy exceptions, and lifecycle safety', async () => {
    const openApi = await readFile(openApiPath, 'utf8');
    const create = openApi.split('    CreateCommentRequest:\n')[1]?.split('    UpdateCommentRequest:')[0];
    const update = openApi.split('    UpdateCommentRequest:\n')[1]?.split('    NotificationType:')[0];

    for (const schema of [create, update]) {
      expect(schema).toContain('required: [body]');
      expect(schema).toContain('bodyFormat:');
      expect(schema).toContain('$ref: "#/components/schemas/AuthoredContentFormat"');
      expect(schema).toContain('UTF-16 code units');
      expect(schema).toContain('VALIDATION_ERROR');
      expect(schema).not.toContain('maxLength:');
    }
    expect(create).toContain('default: plain_text');
    expect(create).toContain('Only explicit mentionMemberIds');
    expect(update).toContain('current locked format');
    expect(update).toContain('Unchanged legacy pairs');
    expect(update).toContain('previousBodyFormat/newBodyFormat');
    expect(update).toContain('never replaces mention rows');
    expect(update).toContain('409 CONFLICT');
  });

  it('documents format-aware description writes without falsely capping historical reads', async () => {
    const openApi = await readFile(openApiPath, 'utf8');
    const create = openApi.split('    CreateWorkItemRequest:\n')[1]?.split('    SetWorkItemParentRequest:')[0];
    const update = openApi.split('    UpdateWorkItemRequest:\n')[1]?.split('    TransitionWorkItemRequest:')[0];

    for (const schema of [create, update]) {
      expect(schema).toContain('descriptionFormat:');
      expect(schema).toContain('$ref: "#/components/schemas/AuthoredContentFormat"');
      expect(schema).toContain('UTF-16 code units');
      expect(schema).toContain('VALIDATION_ERROR');
      expect(schema).not.toContain('maxLength:');
    }
    expect(create).toContain('default: plain_text');
    expect(update).toContain('current locked pair');
    expect(update).toContain('Unchanged legacy pairs');
    expect(update).toContain('full PATCH no-op');
    expect(update).toContain('Description format changed.');
  });

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
      '/api/projects/{projectId}/milestones/{milestoneId}/review',
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
      '/api/projects/{projectId}/cycles',
      '/api/projects/{projectId}/cycles/{cycleId}',
      '/api/projects/{projectId}/cycles/{cycleId}/archive',
      '/api/projects/{projectId}/cycles/{cycleId}/reactivate',
      '/api/projects/{projectId}/cycles/{cycleId}/closeout-preview',
      '/api/projects/{projectId}/cycles/{cycleId}/closeout',
      '/api/projects/{projectId}/cycles/{cycleId}/review',
      '/api/work-items',
      '/api/work-items/export',
      '/api/projects/{projectId}/work-items',
      '/api/projects/{projectId}/board/work-items',
      '/api/projects/{projectId}/work-items/bulk-update',
      '/api/projects/{projectId}/work-items/imports/preview',
      '/api/projects/{projectId}/work-items/imports',
      '/api/projects/{projectId}/work-items/export',
      '/api/work-items/{workItemId}',
      '/api/work-items/{workItemId}/children',
      '/api/work-items/{workItemId}/parent-candidates',
      '/api/work-items/{workItemId}/parent',
      '/api/work-items/{workItemId}/transitions',
      '/api/work-items/{workItemId}/board-move',
      '/api/work-items/{workItemId}/watchers',
      '/api/work-items/{workItemId}/watch',
      '/api/work-items/{workItemId}/comments',
      '/api/comments/{commentId}',
      '/api/work-items/{workItemId}/activity',
      '/api/work-items/{workItemId}/relationships',
      '/api/work-items/{workItemId}/relationships/{relationshipId}',
      '/api/work-items/{workItemId}/attachments',
      '/api/attachments/{attachmentId}/content',
      '/api/attachments/{attachmentId}',
      '/api/my-work',
      '/api/quick-find',
      '/api/saved-work-views',
      '/api/saved-work-views/{savedViewId}'
    ];

    for (const path of requiredPaths) {
      expect(openApi, `missing ${path}`).toContain(`  ${path}:`);
    }

    expect(openApi).toContain('version: 0.2.9');
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
    expect(openApi).toContain('AuthoredContentFormat:');
    expect(openApi).toContain('enum: [plain_text, markdown_v1]');
    expect(openApi).toContain('required: [description, descriptionFormat, relationships, comments, activity]');
    expect(openApi).toContain('body, bodyFormat, mentions');
    expect(openApi).toContain('WorkItemAttachment:');
    expect(openApi).toContain('WorkItemAttachmentList:');
    expect(openApi).toContain('WorkItemAttachmentUsage:');
    expect(openApi).toContain('AttachmentPolicy:');
    expect(openApi).toContain('AttachmentTypePolicy:');
    expect(openApi).toContain('X-Worktrail-Filename');
    expect(openApi).toContain('X-Worktrail-Media-Type');
    expect(openApi).toContain('format: binary');
    expect(openApi).toContain('const: private, no-store');
    expect(openApi).toContain('const: nosniff');
    expect(openApi).toContain('PAYLOAD_TOO_LARGE');
    expect(openApi).toContain('ATTACHMENT_LIMIT_EXCEEDED');
    expect(openApi).toContain('ATTACHMENT_STORAGE_UNAVAILABLE');
    expect(openApi).toContain('QUICK_FIND_UNAVAILABLE');
    expect(openApi).toContain('QuickFindRequest:');
    expect(openApi).toContain('QuickFindResponse:');
    expect(openApi).toContain('QuickFindWorkItemGroup:');
    expect(openApi).toContain('QuickFindProjectGroup:');
    expect(openApi).toContain('QuickFindMilestoneGroup:');
    expect(openApi).toContain('QuickFindCycleGroup:');
    expect(openApi).toContain('QuickFindReportGroup:');
    expect(openApi).toContain('QuickFindAttachmentGroup:');
    expect(openApi).toContain('QuickFindAttachmentResult:');
    expect(openApi).toContain('maxItems: 5');
    expect(openApi).toContain('Search text is carried in the JSON body');
    expect(openApi).not.toContain('storageKey');
    expect(openApi).not.toContain('checksumSha256');
    expect(openApi).toContain('NotificationType:');
    expect(openApi).toContain('NotificationListResponse:');
    expect(openApi).toContain('NotificationUnreadCountResponse:');
    expect(openApi).toContain('UpdateNotificationReadStateRequest:');
    expect(openApi).toContain('WorkItemWatcher:');
    expect(openApi).toContain('WorkItemWatchState:');
    expect(openApi).toContain('BulkUpdateWorkItemsAction:');
    expect(openApi).toContain('BulkUpdateWorkItemsRequest:');
    expect(openApi).toContain('BulkUpdateWorkItemsResponse:');
    expect(openApi).toContain('BulkUpdateWorkItemsResult:');
    expect(openApi).toContain('BulkUpdateWorkItemsErrorCode:');
    expect(openApi).toContain('transition_status');
    expect(openApi).toContain('NOT_IN_PROJECT');
    expect(openApi).toContain('work_item.due_date_changed');
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
    expect(openApi).toContain('MilestoneReviewRiskType:');
    expect(openApi).toContain('MilestoneReviewScopeBreakdown:');
    expect(openApi).toContain('MilestoneReviewRiskSection:');
    expect(openApi).toContain('MilestoneReview:');
    expect(openApi).toContain('ProjectCycleStatus:');
    expect(openApi).toContain('CreatableProjectCycleStatus:');
    expect(openApi).toContain('MutableProjectCycleStatus:');
    expect(openApi).toContain('ProjectCycle:');
    expect(openApi).toContain('CreateProjectCycleRequest:');
    expect(openApi).toContain('UpdateProjectCycleRequest:');
    expect(openApi).toContain('CycleReviewProgress:');
    expect(openApi).toContain('CycleReviewScopeBreakdown:');
    expect(openApi).toContain('CycleReviewRiskType:');
    expect(openApi).toContain('CycleReviewRiskSection:');
    expect(openApi).toContain('ProjectCycleReview:');
    expect(openApi).toContain('ProjectPlanningCycleSummary:');
    expect(openApi).toContain('ProjectCycleCloseoutItemSnapshot:');
    expect(openApi).toContain('ProjectCycleCloseoutCounts:');
    expect(openApi).toContain('ProjectCycleCloseoutDestination:');
    expect(openApi).toContain('ProjectCycleCloseoutSnapshot:');
    expect(openApi).toContain('ProjectCycleCloseout:');
    expect(openApi).toContain('ProjectCycleCloseoutCompactSummary:');
    expect(openApi).toContain('ProjectCycleCloseoutPreview:');
    expect(openApi).toContain('CloseProjectCycleRequest:');
    expect(openApi).toContain('CloseProjectCycleResult:');
    expect(openApi).toContain('enum: [planned, active]');
    expect(openApi).toContain('enum: [planned, active, canceled]');
    expect(openApi).toContain('A matching retry returns the original result');
    expect(openApi).toContain('destinationCycleId` is null');
    expect(openApi).toContain('applied: false');
    expect(openApi).toContain('ProjectStatusReportCycleSnapshot:');
    expect(openApi).toContain('cycle_review');
    expect(openApi).toContain('cycleId:');
    expect(openApi).toContain('set_cycle');
    expect(openApi).toContain('clear_cycle');
    expect(openApi).toContain('work_item.cycle_changed');
    expect(openApi).toContain('cycle_name');
    expect(openApi).toContain('activeCycle:');
    expect(openApi).toContain('upcomingCycle:');
    expect(openApi).toContain('recentlyCompletedCycle:');
    expect(openApi).toContain('cycle_over_target');
    expect(openApi).toContain('unestimated_work');
    expect(openApi).toContain('WorkItemRiskFilter:');
    expect(openApi).toContain('WorkItemHierarchyFilter:');
    expect(openApi).toContain('WorkItemHierarchyQuery:');
    expect(openApi).toContain('WorkItemParentKeyQuery:');
    expect(openApi).toContain('WorkItemParent:');
    expect(openApi).toContain('WorkItemChildSummary:');
    expect(openApi).toContain('WorkItemChildren:');
    expect(openApi).toContain('WorkItemParentCandidate:');
    expect(openApi).toContain('SetWorkItemParentRequest:');
    expect(openApi).toContain('A work item cannot be its own parent.');
    expect(openApi).toContain('Work with children cannot be assigned a parent.');
    expect(openApi).toContain('workRisk:');
    expect(openApi).toContain('hierarchy:');
    expect(openApi).toContain('parentKey:');
    expect(openApi).toContain('deliveryHealth:');
    expect(openApi).toContain('planningReview:');
    expect(openApi).toContain('SavedWorkViewVisibility:');
    expect(openApi).toContain('SavedWorkViewScope:');
    expect(openApi).toContain('enum: [personal, workspace]');
    expect(openApi).toContain('enum: [workspace, project]');
    expect(openApi).toContain('SavedViewScopeQuery:');
    expect(openApi).toContain('SavedViewProjectIdQuery:');
    expect(openApi).toContain(
      'Use `scope=project` with `projectId` to list views saved for one active or archived project.'
    );
    expect(openApi).toContain('New saved views are created unpinned.');
    expect(openApi).toContain('Creating a shared saved view requires owner or maintainer role.');
    expect(openApi).toContain('isPinned:');
    expect(openApi).toContain(
      'Pin or unpin the saved view without changing its name, query, scope, project, or visibility.'
    );
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
    expect(openApi).toContain('EXPORT_LIMIT_EXCEEDED');
    expect(openApi).toContain(
      'More than 10,000 work items match. Narrow the applied filters and retry.'
    );
    expect(openApi).toContain('Paging parameters do not affect exports.');
    expect(openApi).toContain('/api/projects/{projectId}/board/work-items:');
    expect(openApi).toContain('WorkItemPageSizeQuery:');
    expect(openApi).toContain('WorkItemListPage:');
    expect(openApi).toContain('WorkspaceWorkItemListPage:');
    expect(openApi).toContain('Separate page requests may observe intervening writes.');
    expect(openApi).toContain('VALIDATION_ERROR');
    expect(openApi).toContain('INTERNAL_ERROR');
  });
});
