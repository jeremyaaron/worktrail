import { describe, expect, it } from 'vitest';

import {
  applyAuthoredContentCommand as command,
  insertAuthoredContentLink as link,
  type AuthoredContentCommand
} from './authored-content-edit-commands';
import { parseAuthoredContent } from './authored-content-parser';

describe('authored-content edit commands', () => {
  it('wraps a selection and selects its text, preserving all surrounding source', () => {
    expect(command('  before words after\r\n', 9, 14, 'bold')).toEqual({
      source: '  before **words** after\r\n',
      selectionStart: 11,
      selectionEnd: 16
    });
    expect(command('words', 0, 5, 'italic')).toEqual({
      source: '*words*',
      selectionStart: 1,
      selectionEnd: 6
    });
  });

  it('inserts selected placeholders for empty selections', () => {
    expect(command('', 0, 0, 'bold')).toEqual({
      source: '**Bold text**',
      selectionStart: 2,
      selectionEnd: 11
    });
    expect(command('', 0, 0, 'italic')).toEqual({
      source: '*Italic text*',
      selectionStart: 1,
      selectionEnd: 12
    });
    expect(command('', 0, 0, 'inline_code')).toEqual({
      source: '`code`',
      selectionStart: 1,
      selectionEnd: 5
    });
    expect(link('', 0, 0, 'https://example.com')).toEqual({
      source: '[Link text](<https://example.com/>)',
      selectionStart: 1,
      selectionEnd: 10
    });
  });

  it('keeps boundary whitespace outside emphasis and escapes embedded asterisks/backslashes', () => {
    const edit = command('  a*b\\c  ', 0, 9, 'bold');
    expect(edit.source).toBe('  **a\\*b\\\\c**  ');
    const document = parseAuthoredContent(edit.source, 'markdown_v1');
    expect(document.kind).toBe('markdown');
    expect(JSON.stringify(document)).toContain('"kind":"strong"');
    expect(JSON.stringify(document)).toContain('a*b\\\\c');
  });

  it('handles multiline emphasis separately per nonblank line without changing separators', () => {
    const source = 'one\r\n\r\n two \rthree';
    expect(command(source, 0, source.length, 'bold').source).toBe(
      '**one**\r\n\r\n **two** \r**three**'
    );
  });

  for (const [name, expected] of [
    ['heading', 'before\r\n## one\r\n## two\r\nafter'],
    ['bullet_list', 'before\r\n- one\r\n- two\r\nafter'],
    ['ordered_list', 'before\r\n1. one\r\n2. two\r\nafter'],
    ['quote', 'before\r\n> one\r\n> two\r\nafter']
  ] as const) {
    it(`prefixes selected whole lines for ${name} without including the following line`, () => {
      const source = 'before\r\none\r\ntwo\r\nafter';
      expect(command(source, 9, 18, name).source).toBe(expected);
    });
  }

  it('replaces ATX markers and places a caret inside an old marker after the new one', () => {
    expect(command('### title\nlast', 0, 9, 'heading').source).toBe('## title\nlast');
    expect(command('### title', 1, 1, 'heading')).toEqual({
      source: '## title',
      selectionStart: 3,
      selectionEnd: 3
    });
    expect(command('  # title', 8, 8, 'heading')).toEqual({
      source: '  ## title',
      selectionStart: 9,
      selectionEnd: 9
    });
  });

  for (const [name, expected] of [
    ['heading', '## '],
    ['bullet_list', '- '],
    ['ordered_list', '1. '],
    ['quote', '> ']
  ] as const) {
    it(`supports ${name} on an empty line, leaving a typing caret after its prefix`, () => {
      expect(command('', 0, 0, name)).toEqual({
        source: expected,
        selectionStart: expected.length,
        selectionEnd: expected.length
      });
      expect(command('\nend', 0, 0, name).source).toBe(expected + '\nend');
    });
  }

  for (const text of ['a`b``c', '`boundary`', ' code ', ' ', '   ', 'one\ntwo']) {
    it(`chooses a safe inline-code delimiter and padding for ${JSON.stringify(text)}`, () => {
      const edit = command(text, 0, text.length, 'inline_code');
      const document = parseAuthoredContent(edit.source, 'markdown_v1');
      if (document.kind !== 'markdown' || document.blocks[0]?.kind !== 'paragraph')
        throw Error('Expected paragraph');
      expect(document.blocks[0].children).toEqual([
        { kind: 'inline_code', text: text.replace(/\n/gu, ' ') }
      ]);
      expect(edit.source.slice(edit.selectionStart, edit.selectionEnd)).toBe(text);
    });
  }

  it('uses a longer code fence and explicit boundaries around a partial-line selection', () => {
    const source = 'before a```b after';
    const edit = command(source, 7, 12, 'code_block');
    expect(edit.source).toBe('before \n````\na```b\n````\n after');
    expect(edit.source.slice(edit.selectionStart, edit.selectionEnd)).toBe('a```b');
    expect(JSON.stringify(parseAuthoredContent(edit.source, 'markdown_v1'))).toContain(
      '"kind":"code_block"'
    );
  });

  it('preserves existing CRLF boundaries and a selected final newline in fenced code', () => {
    const source = 'before\r\ncode\r\nafter';
    expect(command(source, 8, 14, 'code_block').source).toBe(
      'before\r\n```\r\ncode\r\n```\r\nafter'
    );
  });

  it('escapes link labels and delimits destinations containing parentheses', () => {
    const source = 'before a [b] *c*\\d\nnext after';
    const edit = link(source, 7, 22, 'https://example.com/a_(b)?q=x&z=1')!;
    expect(edit.source.startsWith('before ')).toBe(true);
    expect(edit.source.endsWith(' after')).toBe(true);
    const document = parseAuthoredContent(edit.source, 'markdown_v1');
    expect(JSON.stringify(document)).toContain('"kind":"link"');
    expect(JSON.stringify(document)).not.toContain('"kind":"emphasis"');
    expect(edit.source).toContain('](<https://example.com/a_(b)?q=x&z=1>)');
  });

  for (const url of [
    'javascript:bad()',
    '//example.com',
    '/local',
    'https://user:pass@example.com',
    'https://example.com\\evil'
  ]) {
    it(`rejects unsafe link insertion ${url}`, () => {
      expect(link('label', 0, 5, url)).toBeNull();
    });
  }

  for (const name of [
    'bold',
    'italic',
    'heading',
    'bullet_list',
    'ordered_list',
    'quote',
    'inline_code',
    'code_block'
  ] as AuthoredContentCommand[]) {
    it(`keeps surrogate pairs intact for ${name}`, () => {
      const edit = command('a\ud83d\ude00z', 2, 3, name);
      expect(edit.source).toContain('\ud83d\ude00');
      expect(edit.source.replace(/\ud83d\ude00/gu, '')).not.toMatch(/[\uD800-\uDFFF]/u);
    });
  }

  it('snaps collapsed surrogate/CRLF positions forward, and clamps reversed/out-of-range ranges', () => {
    expect(command('a\ud83d\ude00z', 2, 2, 'bold').source).toBe('a\ud83d\ude00**Bold text**z');
    expect(command('a\r\nb', 2, 2, 'quote').source).toBe('a\r\n> b');
    expect(command('text', 99, -5, 'bold').source).toBe('**text**');
    expect(command('text', Number.NaN, Number.NaN, 'bold').source).toBe('**Bold text**text');
    expect(link('a\ud83d\ude00z', 2, 3, 'https://example.com')?.source).toBe(
      'a[\ud83d\ude00](<https://example.com/>)z'
    );
  });
});
