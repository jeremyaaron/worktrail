import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  authoredContentFormats,
  authoredContentSourceLimit,
  normalizeAuthoredContentSource,
  type AuthoredContentFormat,
  type CommentDto,
  type CreateCommentRequest,
  type CreateWorkItemRequest,
  type UpdateWorkItemRequest,
  type UpdateCommentRequest,
  type WorkItemDetailDto,
  type WorkItemCsvImportPreviewRowDto,
  type WorkItemListItemDto
} from './index.js';

describe('authored content primitives', () => {
  it('exports the finite source-format vocabulary and UTF-16 source limit', () => {
    expect(authoredContentFormats).toEqual(['plain_text', 'markdown_v1']);
    expectTypeOf<AuthoredContentFormat>().toEqualTypeOf<'plain_text' | 'markdown_v1'>();
    expectTypeOf(authoredContentFormats).toEqualTypeOf<readonly ['plain_text', 'markdown_v1']>();
    expect(authoredContentSourceLimit).toBe(10_000);
  });

  it.each([
    ['', ''],
    ['first\r\nsecond\rthird\n', 'first\nsecond\nthird\n'],
    ['\r\n\r\r\n', '\n\n\n'],
    ['  indented\tcode  \r\n\r\n', '  indented\tcode  \n\n'],
    ['**literal** <tag> &amp;\n', '**literal** <tag> &amp;\n'],
    ['Cafe\u0301\u2028\u2029\u{1f600}', 'Cafe\u0301\u2028\u2029\u{1f600}']
  ])('normalizes line endings without other source changes: %j', (source, expected) => {
    const normalized = normalizeAuthoredContentSource(source);

    expect(normalized).toBe(expected);
    expect(normalizeAuthoredContentSource(normalized)).toBe(normalized);
  });

  it('does not truncate or validate legacy-sized strings', () => {
    const source = `${'\u{1f600}'.repeat(authoredContentSourceLimit)}\r\n`;

    expect(normalizeAuthoredContentSource(source)).toBe(
      `${'\u{1f600}'.repeat(authoredContentSourceLimit)}\n`
    );
  });

  it('requires persisted formats on authored-content reads without growing list contracts', () => {
    expectTypeOf<WorkItemDetailDto['descriptionFormat']>().toEqualTypeOf<AuthoredContentFormat>();
    expectTypeOf<CommentDto['bodyFormat']>().toEqualTypeOf<AuthoredContentFormat>();
    expectTypeOf<'descriptionFormat'>().not.toMatchTypeOf<keyof WorkItemListItemDto>();
    expectTypeOf<'description'>().not.toMatchTypeOf<keyof WorkItemListItemDto>();
  });

  it('keeps work-item write formats optional for legacy clients and format-only patches', () => {
    expectTypeOf<CreateWorkItemRequest['descriptionFormat']>()
      .toEqualTypeOf<AuthoredContentFormat | undefined>();
    expectTypeOf<UpdateWorkItemRequest['descriptionFormat']>()
      .toEqualTypeOf<AuthoredContentFormat | undefined>();
    const legacy: CreateWorkItemRequest = { title: 'Legacy', type: 'task', priority: 'medium' };
    const conversion: UpdateWorkItemRequest = { descriptionFormat: 'markdown_v1' };

    expect(legacy.descriptionFormat).toBeUndefined();
    expect(conversion.description).toBeUndefined();
  });

  it('keeps comment formats optional and comment update body required', () => {
    expectTypeOf<CreateCommentRequest['bodyFormat']>()
      .toEqualTypeOf<AuthoredContentFormat | undefined>();
    expectTypeOf<UpdateCommentRequest['bodyFormat']>()
      .toEqualTypeOf<AuthoredContentFormat | undefined>();
    expectTypeOf<UpdateCommentRequest['body']>().toEqualTypeOf<string>();
    const legacy: CreateCommentRequest = { body: 'Legacy comment' };
    const conversion: UpdateCommentRequest = { body: legacy.body, bodyFormat: 'markdown_v1' };

    expect(legacy.bodyFormat).toBeUndefined();
    expect(conversion.bodyFormat).toBe('markdown_v1');
  });

  it('requires format metadata and a source excerpt on CSV preview rows', () => {
    expectTypeOf<WorkItemCsvImportPreviewRowDto['descriptionFormat']>()
      .toEqualTypeOf<AuthoredContentFormat>();
    expectTypeOf<WorkItemCsvImportPreviewRowDto['descriptionExcerpt']>().toEqualTypeOf<string>();
    expectTypeOf<'description'>().not.toMatchTypeOf<keyof WorkItemCsvImportPreviewRowDto>();
  });
});
