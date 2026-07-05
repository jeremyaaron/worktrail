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
      '/api/projects/{projectId}/work-items',
      '/api/work-items/{workItemId}',
      '/api/work-items/{workItemId}/transitions',
      '/api/work-items/{workItemId}/board-move',
      '/api/work-items/{workItemId}/comments',
      '/api/comments/{commentId}',
      '/api/work-items/{workItemId}/activity',
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
    expect(openApi).toContain('VALIDATION_ERROR');
    expect(openApi).toContain('INTERNAL_ERROR');
  });
});
