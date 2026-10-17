import { authoredContentSourceLimit, normalizeAuthoredContentSource } from '@worktrail/contracts';
import MarkdownIt, { type Token } from 'markdown-it';
import type {
  AuthoredContentBlock,
  AuthoredContentDocument,
  AuthoredContentInline,
  AuthoredContentListItem
} from './authored-content-document';
import { authoredContentLink } from './authored-content-link';

const parserNestingLimit = 16;
const parser = new MarkdownIt('commonmark', {
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
  maxNesting: parserNestingLimit
});
parser.disable(['hr']);
parser.validateLink = (href) => authoredContentLink(href) !== null;

export function parseAuthoredContent(source: string, format: string): AuthoredContentDocument {
  if (format === 'plain_text') return { kind: 'plain_text', source };
  const fallback: AuthoredContentDocument = { kind: 'plain_text_fallback', source };
  if (format !== 'markdown_v1') return fallback;
  const normalized = normalizeAuthoredContentSource(source);
  if (normalized.length > authoredContentSourceLimit) return fallback;
  try {
    const projection = new Projection();
    const cursor = new TokenCursor(parser.parse(normalized, {}), projection);
    return { kind: 'markdown', blocks: projection.blocks(cursor, 1) };
  } catch {
    return fallback;
  }
}

class TokenCursor {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly projection: Projection
  ) {}

  get type(): string | undefined {
    return this.tokens[this.index]?.type;
  }

  take(type?: string, nesting?: number): Token {
    const token = this.tokens[this.index++];
    this.projection.token();
    if (
      !token ||
      (type !== undefined && token.type !== type) ||
      (nesting !== undefined && token.nesting !== nesting)
    ) {
      throw new Error('Unexpected authored-content token structure');
    }
    if (token.children !== null && token.type !== 'inline' && token.type !== 'image') {
      throw new Error('Unexpected authored-content children');
    }
    // The block parser can skip source at its nesting ceiling rather than emit literal tokens.
    if (token.block && token.nesting === 1 && token.level >= parserNestingLimit - 1) {
      throw new Error('Authored-content parser nesting ceiling');
    }
    return token;
  }
}

class Projection {
  private tokenCount = 0;
  private nodeCount = 0;
  private textUnits = 0;

  token(): void {
    if (++this.tokenCount > 8000) throw new Error('Authored-content token limit');
  }

  private node<T>(node: T, depth: number, text = ''): T {
    if (++this.nodeCount > 4000 || depth > 32) throw new Error('Authored-content node/depth limit');
    this.textUnits += text.length;
    if (this.textUnits > 64000) throw new Error('Authored-content text limit');
    return node;
  }

  blocks(
    cursor: TokenCursor,
    depth: number,
    closing?: string,
    inListItem = false
  ): AuthoredContentBlock[] {
    if (depth > 32) throw new Error('Authored-content depth limit');
    const nodes: AuthoredContentBlock[] = [];
    while (cursor.type !== undefined && cursor.type !== closing) {
      const token = cursor.take();
      switch (token.type) {
        case 'paragraph_open': {
          this.open(token);
          if (token.hidden && !inListItem) throw new Error('Unexpected tight paragraph');
          const children = this.inlineBlock(cursor, depth + 1);
          const close = cursor.take('paragraph_close', -1);
          if (close.hidden !== token.hidden) throw new Error('Mismatched tight paragraph');
          nodes.push(
            this.node({ kind: 'paragraph', tight: token.hidden, children } as const, depth)
          );
          break;
        }
        case 'heading_open': {
          this.open(token);
          if (!/^h[1-6]$/u.test(token.tag)) throw new Error('Unexpected heading level');
          const level = Math.min(Number(token.tag.slice(1)) + 2, 6) as 3 | 4 | 5 | 6;
          const children = this.inlineBlock(cursor, depth + 1);
          const close = cursor.take('heading_close', -1);
          if (close.tag !== token.tag) throw new Error('Mismatched heading');
          nodes.push(this.node({ kind: 'heading', level, children } as const, depth));
          break;
        }
        case 'blockquote_open': {
          this.open(token);
          const children = this.blocks(cursor, depth + 1, 'blockquote_close');
          cursor.take('blockquote_close', -1);
          nodes.push(this.node({ kind: 'quotation', children } as const, depth));
          break;
        }
        case 'bullet_list_open':
        case 'ordered_list_open': {
          this.open(token);
          const ordered = token.type === 'ordered_list_open';
          const close = ordered ? 'ordered_list_close' : 'bullet_list_close';
          const items: AuthoredContentListItem[] = [];
          while (cursor.type === 'list_item_open') {
            cursor.take('list_item_open', 1);
            const children = this.blocks(cursor, depth + 2, 'list_item_close', true);
            cursor.take('list_item_close', -1);
            items.push(this.node({ kind: 'list_item', children } as const, depth + 1));
          }
          cursor.take(close, -1);
          if (!items.length) throw new Error('Empty list token structure');
          if (ordered) {
            const rawStart = token.attrGet('start');
            const start = rawStart === null ? 1 : Number(rawStart);
            if (!Number.isInteger(start) || start < 0 || start > 999999999) {
              throw new Error('Unexpected ordered-list start');
            }
            nodes.push(this.node({ kind: 'ordered_list', start, items } as const, depth));
          } else {
            nodes.push(this.node({ kind: 'unordered_list', items } as const, depth));
          }
          break;
        }
        case 'fence':
        case 'code_block':
          this.leaf(token);
          nodes.push(
            this.node({ kind: 'code_block', text: token.content } as const, depth, token.content)
          );
          break;
        default:
          throw new Error('Unsupported authored-content block');
      }
    }
    return nodes;
  }

  private inlineBlock(cursor: TokenCursor, depth: number): AuthoredContentInline[] {
    const token = cursor.take('inline', 0);
    if (token.children === null) throw new Error('Missing authored-content inline children');
    return this.inlines(new TokenCursor(token.children, this), depth);
  }

  private inlines(
    cursor: TokenCursor,
    depth: number,
    closing?: string,
    inLink = false
  ): AuthoredContentInline[] {
    if (depth > 32) throw new Error('Authored-content depth limit');
    const nodes: AuthoredContentInline[] = [];
    while (cursor.type !== undefined && cursor.type !== closing) {
      const token = cursor.take();
      switch (token.type) {
        case 'text':
        case 'code_inline':
          this.leaf(token);
          if (token.content) {
            nodes.push(
              this.node(
                {
                  kind: token.type === 'text' ? 'text' : 'inline_code',
                  text: token.content
                } as const,
                depth,
                token.content
              )
            );
          }
          break;
        case 'softbreak':
        case 'hardbreak':
          this.leaf(token);
          nodes.push(this.node({ kind: 'break' } as const, depth));
          break;
        case 'em_open':
        case 'strong_open': {
          this.open(token);
          const close = token.type === 'em_open' ? 'em_close' : 'strong_close';
          const children = this.inlines(cursor, depth + 1, close, inLink);
          cursor.take(close, -1);
          nodes.push(
            this.node(
              { kind: token.type === 'em_open' ? 'emphasis' : 'strong', children } as const,
              depth
            )
          );
          break;
        }
        case 'link_open': {
          this.open(token);
          if (inLink) throw new Error('Nested authored-content link');
          const children = this.inlines(cursor, depth + 1, 'link_close', true);
          cursor.take('link_close', -1);
          const destination = token.attrGet('href');
          const href = typeof destination === 'string' ? authoredContentLink(destination) : null;
          if (href) nodes.push(this.node({ kind: 'link', href, children } as const, depth, href));
          else nodes.push(...children);
          break;
        }
        case 'image': {
          this.leaf(token);
          const children = this.inlines(
            new TokenCursor(token.children ?? [], this),
            depth + 1,
            undefined,
            inLink
          );
          const text = this.labelText(children) || 'Image';
          nodes.push(this.node({ kind: 'text', text } as const, depth, text));
          break;
        }
        default:
          throw new Error('Unsupported authored-content inline');
      }
    }
    return nodes;
  }

  private labelText(nodes: readonly AuthoredContentInline[]): string {
    return nodes
      .map((node) => {
        switch (node.kind) {
          case 'text':
          case 'inline_code':
            return node.text;
          case 'break':
            return '\n';
          case 'emphasis':
          case 'strong':
          case 'link':
            return this.labelText(node.children);
          default:
            return this.unreachable(node);
        }
      })
      .join('');
  }

  private open(token: Token): void {
    if (token.nesting !== 1) throw new Error('Expected authored-content opener');
  }

  private leaf(token: Token): void {
    if (token.nesting !== 0) throw new Error('Expected authored-content leaf');
  }

  private unreachable(value: never): never {
    throw new Error(`Unexpected authored-content node kind: ${typeof value}`);
  }
}
