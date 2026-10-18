import { afterEach, describe, expect, it, vi } from 'vitest';

import MarkdownIt, { type Token } from 'markdown-it';
import type { AuthoredContentBlock, AuthoredContentDocument } from './authored-content-document';
import { parseAuthoredContent } from './authored-content-parser';

function token(
  type: string,
  nesting: -1 | 0 | 1 = 0,
  content = '',
  attrs: Record<string, string> = {}
): Token {
  return {
    type,
    nesting,
    content,
    tag: '',
    children: null,
    hidden: false,
    attrGet: (name: string) => attrs[name] ?? null
  } as Token;
}

function paragraph(children: Token[]): Token[] {
  return [
    token('paragraph_open', 1),
    Object.assign(token('inline'), { children }),
    token('paragraph_close', -1)
  ];
}

function blocks(document: AuthoredContentDocument): readonly AuthoredContentBlock[] {
  if (document.kind !== 'markdown') throw new Error('Expected Markdown projection');
  return document.blocks;
}

describe('authored-content parser and projection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never parses plain text, including complete oversized legacy text', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse').mockImplementation(() => { throw new Error('must not parse'); });
    const source = `  **literal**\r\n${'x'.repeat(20000)}  `;
    expect(parseAuthoredContent(source, 'plain_text')).toEqual({ kind: 'plain_text', source });
    expect(parse).not.toHaveBeenCalled();
  });

  it('keeps unknown formats complete and literal without parsing', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse').mockImplementation(() => { throw new Error('must not parse'); });
    const source = '<script>bad()</script>\r\n**source**';
    expect(parseAuthoredContent(source, 'future_format')).toEqual({
      kind: 'plain_text_fallback',
      source
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it('normalizes line endings only for parsing, with a fresh reference environment each time', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    parseAuthoredContent('one\r\ntwo\rthree', 'markdown_v1');
    parseAuthoredContent('[label][ref]\n\n[ref]: https://example.com', 'markdown_v1');
    const third = parseAuthoredContent('[label][ref]', 'markdown_v1');
    expect(parse.mock.calls[0][0]).toBe('one\ntwo\nthree');
    expect(parse.mock.calls[0][1]).not.toBe(parse.mock.calls[1][1]);
    expect(JSON.stringify(third)).not.toContain('"kind":"link"');
  });

  it('maps ATX/Setext headings below the page headings and clamps deep levels', () => {
    const nodes = blocks(
      parseAuthoredContent('# A\n\nB\n===\n\nC\n---\n\n### D\n\n#### E\n\n###### F', 'markdown_v1')
    );
    expect(nodes.map((node) => (node.kind === 'heading' ? node.level : null))).toEqual([
      3, 3, 4, 5, 6, 6
    ]);
  });

  it('projects nested emphasis, inline code and both kinds of visible breaks', () => {
    const nodes = blocks(
      parseAuthoredContent('**strong *em*** `code`\nsoft  \nhard', 'markdown_v1')
    );
    expect(nodes[0]).toEqual({
      kind: 'paragraph',
      tight: false,
      children: [
        {
          kind: 'strong',
          children: [
            { kind: 'text', text: 'strong ' },
            { kind: 'emphasis', children: [{ kind: 'text', text: 'em' }] }
          ]
        },
        { kind: 'text', text: ' ' },
        { kind: 'inline_code', text: 'code' },
        { kind: 'break' },
        { kind: 'text', text: 'soft' },
        { kind: 'break' },
        { kind: 'text', text: 'hard' }
      ]
    });
  });

  it('projects tight/loose nested lists, ordered starts, quotes and literal code', () => {
    const source =
      '- one\n  - nested\n- two\n\n3. three\n\n4. four\n\n> quote\n\n```html onclick=bad\n<img src=x>\n```\n\n    indented\n';
    const nodes = blocks(parseAuthoredContent(source, 'markdown_v1'));
    expect(nodes.map((node) => node.kind)).toEqual([
      'unordered_list',
      'ordered_list',
      'quotation',
      'code_block',
      'code_block'
    ]);
    expect(nodes[0]).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            children: [
              expect.objectContaining({ tight: true }),
              expect.objectContaining({ kind: 'unordered_list' })
            ]
          }),
          expect.objectContaining({ children: [expect.objectContaining({ tight: true })] })
        ]
      })
    );
    expect(nodes[1]).toEqual(
      expect.objectContaining({
        start: 3,
        items: [
          expect.objectContaining({ children: [expect.objectContaining({ tight: false })] }),
          expect.objectContaining({ children: [expect.objectContaining({ tight: false })] })
        ]
      })
    );
    expect(nodes[3]).toEqual({ kind: 'code_block', text: '<img src=x>\n' });
    expect(nodes[4]).toEqual({ kind: 'code_block', text: 'indented\n' });
    expect(JSON.stringify(nodes)).not.toContain('onclick');
  });

  it('flattens image label formatting to plain alternative text, discarding all destinations', () => {
    const nodes = blocks(
      parseAuthoredContent(
        '![**alt** `code`](https://remote.example/img "title") ![](https://remote.example/empty)',
        'markdown_v1'
      )
    );
    expect(nodes[0]).toEqual({
      kind: 'paragraph',
      tight: false,
      children: [
        { kind: 'text', text: 'alt code' },
        { kind: 'text', text: ' ' },
        { kind: 'text', text: 'Image' }
      ]
    });
    expect(JSON.stringify(nodes)).not.toContain('remote.example');
  });

  it('preserves unsupported syntax, raw HTML, incomplete delimiters and unlinked bare URLs as text', () => {
    const source =
      '<script>alert(1)</script>\n\n| A | B |\n| - | - |\n\n- [x] task\n\n~~strike~~\n\n---\n\n**unfinished\n\nhttps://example.com';
    const document = parseAuthoredContent(source, 'markdown_v1');
    expect(document.kind).toBe('markdown');
    const json = JSON.stringify(document);
    for (const literal of [
      '<script>alert(1)</script>',
      '| A | B |',
      '[x] task',
      '~~strike~~',
      '---',
      '**unfinished',
      'https://example.com'
    ]) {
      expect(json, literal).toContain(literal);
    }
    expect(json).not.toContain('"kind":"link"');
  });

  it('preserves formatted labels and parser-normalized entities in safe links', () => {
    const nodes = blocks(
      parseAuthoredContent('[**bold**](https://example.com/?a=1&amp;b=2 "ignored")', 'markdown_v1')
    );
    expect(nodes[0]).toEqual({
      kind: 'paragraph',
      tight: false,
      children: [
        {
          kind: 'link',
          href: 'https://example.com/?a=1&b=2',
          children: [{ kind: 'strong', children: [{ kind: 'text', text: 'bold' }] }]
        }
      ]
    });
  });

  for (const destination of [
    'javascript:alert%281%29',
    'java&#x73;cript:alert%281%29',
    'data:text/html,test',
    '//evil.example',
    '/local',
    '#fragment',
    'mailto:a@example.com',
    'https://user:pass@example.com',
    'https:///example.com'
  ]) {
    it(`leaves rejected parser destination ${destination} readable and unlinked`, () => {
      const document = parseAuthoredContent(`[label](${destination})`, 'markdown_v1');
      expect(document.kind).toBe('markdown');
      expect(JSON.stringify(document)).toContain('label');
      expect(JSON.stringify(document)).not.toContain('"kind":"link"');
    });
  }

  it('validates projected href again and retains a rejected label without an anchor', () => {
    vi.spyOn(MarkdownIt.prototype, 'parse').mockReturnValue(
      paragraph([
        token('link_open', 1, '', { href: 'javascript:bad()', onclick: 'bad()' }),
        token('text', 0, 'retained label'),
        token('link_close', -1)
      ])
    );
    expect(blocks(parseAuthoredContent('original', 'markdown_v1'))[0]).toEqual({
      kind: 'paragraph',
      tight: false,
      children: [{ kind: 'text', text: 'retained label' }]
    });
  });

  it('does not call any HTML renderer', () => {
    const render = vi.spyOn(MarkdownIt.prototype, 'render').mockImplementation(() => { throw new Error('forbidden'); });
    const renderInline = vi.spyOn(MarkdownIt.prototype, 'renderInline').mockImplementation(() => { throw new Error('forbidden'); });
    expect(parseAuthoredContent('**safe**', 'markdown_v1').kind).toBe('markdown');
    expect(render).not.toHaveBeenCalled();
    expect(renderInline).not.toHaveBeenCalled();
  });

  it('enforces the normalized parse limit, including CRLF and UTF-16 surrogate units', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    expect(parseAuthoredContent('\r\n'.repeat(10000), 'markdown_v1').kind).toBe('markdown');
    expect(parseAuthoredContent('\ud83d\ude00'.repeat(5000), 'markdown_v1').kind).toBe('markdown');
    const source = '\ud83d\ude00'.repeat(5000) + 'x';
    expect(parseAuthoredContent(source, 'markdown_v1')).toEqual({
      kind: 'plain_text_fallback',
      source
    });
    expect(parse.mock.calls.length).toBe(2);
  });

  it('bounds all inspected tokens, including inline children without projected nodes', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    parse.mockReturnValue(paragraph(Array.from({ length: 7997 }, () => token('text'))));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('markdown');
    parse.mockReturnValue(paragraph(Array.from({ length: 7998 }, () => token('text'))));
    expect(parseAuthoredContent('source', 'markdown_v1')).toEqual({
      kind: 'plain_text_fallback',
      source: 'source'
    });
  });

  it('bounds presentation nodes independently of tokens', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    parse.mockReturnValue(paragraph(Array.from({ length: 3999 }, () => token('text', 0, 'x'))));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('markdown');
    parse.mockReturnValue(paragraph(Array.from({ length: 4000 }, () => token('text', 0, 'x'))));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('plain_text_fallback');
  });

  it('bounds tree depth independently of the parser nesting limit', () => {
    const nested = (count: number) =>
      paragraph([
        ...Array.from({ length: count }, () => token('em_open', 1)),
        token('text', 0, 'x'),
        ...Array.from({ length: count }, () => token('em_close', -1))
      ]);
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    parse.mockReturnValue(nested(30));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('markdown');
    parse.mockReturnValue(nested(31));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('plain_text_fallback');
  });

  it('bounds aggregate projected UTF-16 text and URLs', () => {
    const parse = vi.spyOn(MarkdownIt.prototype, 'parse');
    parse.mockReturnValue(paragraph([token('text', 0, 'x'.repeat(64000))]));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('markdown');
    parse.mockReturnValue(paragraph([token('text', 0, 'x'.repeat(64001))]));
    expect(parseAuthoredContent('source', 'markdown_v1').kind).toBe('plain_text_fallback');
  });

  it('falls back completely for reference expansion that exceeds aggregate data limits', () => {
    const source = `${'[label][ref] '.repeat(40)}\n\n[ref]: https://example.com/${'a'.repeat(1800)}`;
    expect(source.length).toBeLessThan(10000);
    expect(parseAuthoredContent(source, 'markdown_v1')).toEqual({
      kind: 'plain_text_fallback',
      source
    });
  });

  for (const malformed of [
    [token('html_block', 0, '<script>bad()</script>')],
    [token('paragraph_open', 1)],
    paragraph([token('em_open', 1), token('text', 0, 'missing close')]),
    paragraph([token('strong_close', -1)]),
    paragraph([
      token('link_open', 1, '', { href: 'https://example.com' }),
      token('link_open', 1),
      token('text', 0, 'nested'),
      token('link_close', -1),
      token('link_close', -1)
    ]),
    [Object.assign(token('heading_open', 1), { tag: 'h99' })],
    [Object.assign(token('paragraph_open', 1), { children: [token('text')] })],
    [token('ordered_list_open', 1), token('ordered_list_close', -1)],
    [
      token('ordered_list_open', 1, '', { start: 'bad' }),
      token('list_item_open', 1),
      token('list_item_close', -1),
      token('ordered_list_close', -1)
    ]
  ]) {
    it(`falls back completely on malformed/unsupported ${malformed.map((t) => t.type).join(',')}`, () => {
      vi.spyOn(MarkdownIt.prototype, 'parse').mockReturnValue(malformed);
      const source = '  complete\r\n<script>source</script>  ';
      expect(parseAuthoredContent(source, 'markdown_v1')).toEqual({
        kind: 'plain_text_fallback',
        source
      });
    });
  }

  it('falls back completely on parser exceptions without logging source', () => {
    vi.spyOn(MarkdownIt.prototype, 'parse').mockImplementation(() => { throw new Error('parser error'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parseAuthoredContent('complete\r\nsource', 'markdown_v1')).toEqual({
      kind: 'plain_text_fallback',
      source: 'complete\r\nsource'
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('falls back completely before the block nesting ceiling can discard source', () => {
    expect(parseAuthoredContent(`${'> '.repeat(14)}tail`, 'markdown_v1').kind).toBe('markdown');
    for (const depth of [15, 16, 100]) {
      const source = `${'> '.repeat(depth)}tail`;
      expect(parseAuthoredContent(source, 'markdown_v1')).toEqual({
        kind: 'plain_text_fallback',
        source
      });
    }
  });
});
