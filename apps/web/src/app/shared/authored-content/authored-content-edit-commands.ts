import { authoredContentLink } from './authored-content-link';

export type AuthoredContentCommand =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'bullet_list'
  | 'ordered_list'
  | 'quote'
  | 'inline_code'
  | 'code_block';

export interface AuthoredContentTextEdit {
  readonly source: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export function applyAuthoredContentCommand(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  command: AuthoredContentCommand
): AuthoredContentTextEdit {
  const [start, end] = selection(source, selectionStart, selectionEnd);
  const selected = source.slice(start, end);
  switch (command) {
    case 'bold':
    case 'italic': {
      const marker = command === 'bold' ? '**' : '*';
      const placeholder = command === 'bold' ? 'Bold text' : 'Italic text';
      const wrap = (line: string) => {
        const leading = /^\s*/u.exec(line)![0];
        const content = line.slice(leading.length);
        const trailing = /\s*$/u.exec(content)![0];
        const text = content.slice(0, content.length - trailing.length) || placeholder;
        const escaped = text.replace(/[\\*]/gu, '\\$&');
        return {
          text: `${leading}${marker}${escaped}${marker}${trailing}`,
          offset: leading.length + marker.length,
          length: escaped.length
        };
      };
      if (/[\r\n]/u.test(selected)) {
        const replacement = selected
          .split(/(\r\n|\r|\n)/u)
          .map((line, index) => (index % 2 || !line.trim() ? line : wrap(line).text))
          .join('');
        return replace(source, start, end, replacement);
      }
      const wrapped = wrap(selected);
      return replace(source, start, end, wrapped.text, wrapped.offset, wrapped.length);
    }
    case 'inline_code': {
      const text = selected || 'code';
      const delimiter = '`'.repeat(Math.max(1, longestBackticks(text) + 1));
      const padding =
        /^`|`$/u.test(text) || (/^ .* $/su.test(text) && /[^ ]/u.test(text)) ? ' ' : '';
      return replace(
        source,
        start,
        end,
        `${delimiter}${padding}${text}${padding}${delimiter}`,
        delimiter.length + padding.length,
        text.length
      );
    }
    case 'code_block': {
      const text = selected || 'code';
      const fence = '`'.repeat(Math.max(3, longestBackticks(text) + 1));
      const newline = source.includes('\r\n')
        ? '\r\n'
        : source.includes('\r') && !source.includes('\n')
          ? '\r'
          : '\n';
      const leading = start > 0 && !/[\r\n]/u.test(source[start - 1]) ? newline : '';
      const trailing = end < source.length && !/[\r\n]/u.test(source[end]) ? newline : '';
      const opening = `${leading}${fence}${newline}`;
      return replace(
        source,
        start,
        end,
        `${opening}${text}${/[\r\n]$/u.test(text) ? '' : newline}${fence}${trailing}`,
        opening.length,
        text.length
      );
    }
    case 'heading':
    case 'bullet_list':
    case 'ordered_list':
    case 'quote': {
      const lineStart =
        start === 0
          ? 0
          : Math.max(source.lastIndexOf('\n', start - 1), source.lastIndexOf('\r', start - 1)) + 1;
      const lastSelected = end > start ? end - 1 : end;
      const last =
        source[lastSelected] === '\n' && source[lastSelected - 1] === '\r'
          ? lastSelected - 1
          : lastSelected;
      const nextBreak = source.slice(last).search(/[\r\n]/u);
      const lineEnd = nextBreak === -1 ? source.length : last + nextBreak;
      let number = 0;
      const replacement = source
        .slice(lineStart, lineEnd)
        .split(/(\r\n|\r|\n)/u)
        .map((line, index) => {
          if (index % 2) return line;
          switch (command) {
            case 'heading':
              return line.replace(/^([ \t]*)(?:#{1,6}(?:[ \t]+|$))?/u, '$1## ');
            case 'bullet_list':
              return `- ${line}`;
            case 'ordered_list':
              return `${++number}. ${line}`;
            case 'quote':
              return `> ${line}`;
          }
        })
        .join('');
      if (start === end) {
        let offset = Math.max(0, start - lineStart + replacement.length - (lineEnd - lineStart));
        if (command === 'heading') {
          const previousPrefix = /^([ \t]*)(?:#{1,6}(?:[ \t]+|$))?/u.exec(
            source.slice(lineStart, lineEnd)
          )!;
          if (start - lineStart <= previousPrefix[0].length) offset = previousPrefix[1].length + 3;
        }
        return replace(source, lineStart, lineEnd, replacement, offset, 0);
      }
      return replace(source, lineStart, lineEnd, replacement);
    }
  }
}

export function insertAuthoredContentLink(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  url: string
): AuthoredContentTextEdit | null {
  const href = authoredContentLink(url);
  if (!href) return null;
  const [start, end] = selection(source, selectionStart, selectionEnd);
  const selected = source.slice(start, end);
  const label = (selected.trim() ? selected : 'Link text')
    .replace(/\r\n?|\n/gu, ' ')
    .replace(/[\\`*_[\]{}()#+.!|<>~-]/gu, '\\$&');
  const destination = href.replace(/</gu, '%3C').replace(/>/gu, '%3E');
  return replace(source, start, end, `[${label}](<${destination}>)`, 1, label.length);
}

function longestBackticks(source: string): number {
  let longest = 0;
  for (const match of source.matchAll(/`+/gu)) longest = Math.max(longest, match[0].length);
  return longest;
}

function selection(source: string, from: number, to: number): [number, number] {
  const clamp = (value: number) =>
    Math.min(source.length, Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0));
  let start = Math.min(clamp(from), clamp(to));
  let end = Math.max(clamp(from), clamp(to));
  const splitsPair = (offset: number) =>
    offset > 0 &&
    offset < source.length &&
    ((/[\uD800-\uDBFF]/u.test(source[offset - 1]) && /[\uDC00-\uDFFF]/u.test(source[offset])) ||
      (source[offset - 1] === '\r' && source[offset] === '\n'));
  if (start === end && splitsPair(start)) return [start + 1, end + 1];
  if (splitsPair(start)) start--;
  if (splitsPair(end)) end++;
  return [start, end];
}

function replace(
  source: string,
  start: number,
  end: number,
  replacement: string,
  offset = 0,
  length = replacement.length
): AuthoredContentTextEdit {
  return {
    source: source.slice(0, start) + replacement + source.slice(end),
    selectionStart: start + offset,
    selectionEnd: start + offset + length
  };
}
