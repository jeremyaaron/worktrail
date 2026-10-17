export const authoredContentFormats = ['plain_text', 'markdown_v1'] as const;

export type AuthoredContentFormat = (typeof authoredContentFormats)[number];

export const authoredContentSourceLimit = 10_000;

export function normalizeAuthoredContentSource(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}
