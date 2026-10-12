export type AuthoredContentInline =
  | { readonly kind: 'text' | 'inline_code'; readonly text: string }
  | { readonly kind: 'break' }
  | { readonly kind: 'emphasis' | 'strong'; readonly children: readonly AuthoredContentInline[] }
  | {
      readonly kind: 'link';
      readonly href: string;
      readonly children: readonly AuthoredContentInline[];
    };

export interface AuthoredContentListItem {
  readonly kind: 'list_item';
  readonly children: readonly AuthoredContentBlock[];
}

export type AuthoredContentBlock =
  | {
      readonly kind: 'paragraph';
      readonly tight: boolean;
      readonly children: readonly AuthoredContentInline[];
    }
  | {
      readonly kind: 'heading';
      readonly level: 3 | 4 | 5 | 6;
      readonly children: readonly AuthoredContentInline[];
    }
  | { readonly kind: 'quotation'; readonly children: readonly AuthoredContentBlock[] }
  | { readonly kind: 'unordered_list'; readonly items: readonly AuthoredContentListItem[] }
  | {
      readonly kind: 'ordered_list';
      readonly start: number;
      readonly items: readonly AuthoredContentListItem[];
    }
  | { readonly kind: 'code_block'; readonly text: string };

export type AuthoredContentDocument =
  | { readonly kind: 'plain_text' | 'plain_text_fallback'; readonly source: string }
  | { readonly kind: 'markdown'; readonly blocks: readonly AuthoredContentBlock[] };
