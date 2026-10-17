import { TestBed, type ComponentFixture } from '@angular/core/testing';
import MarkdownIt from 'markdown-it';
import { AuthoredContentViewerComponent } from './authored-content-viewer.component';

describe('AuthoredContentViewerComponent', () => {
  let fixture: ComponentFixture<AuthoredContentViewerComponent>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthoredContentViewerComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(AuthoredContentViewerComponent);
    root = fixture.nativeElement as HTMLElement;
    root.style.display = 'block';
    root.style.width = '320px';
  });

  async function render(source: string, format = 'markdown_v1'): Promise<void> {
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('format', format);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function assertSafeDom(): void {
    expect(
      root.querySelectorAll(
        'script,img,iframe,object,embed,svg,math,style,link,form,input,button,video,audio,source,table,h1,h2,hr'
      ).length
    ).toBe(0);
    const allowed = new Set([
      'DIV',
      'P',
      'H3',
      'H4',
      'H5',
      'H6',
      'UL',
      'OL',
      'LI',
      'BLOCKQUOTE',
      'PRE',
      'CODE',
      'EM',
      'STRONG',
      'A',
      'BR'
    ]);
    for (const element of Array.from(root.querySelectorAll('*'))) {
      expect(allowed.has(element.tagName)).withContext(element.tagName).toBeTrue();
      for (const attr of Array.from(element.attributes)) {
        expect(/^on/iu.test(attr.name)).withContext(attr.name).toBeFalse();
        expect(['src', 'srcdoc', 'style', 'id', 'name', 'title'].includes(attr.name))
          .withContext(attr.name)
          .toBeFalse();
      }
    }
  }

  it('renders plain text and fallback completely, with no markup interpretation', async () => {
    const source = `  **literal** <img src=x onerror=bad()>\n${'x'.repeat(12000)}  `;
    for (const format of ['plain_text', 'unknown', 'markdown_v1']) {
      await render(source, format);
      expect(root.querySelector('.plain-content')?.textContent).toBe(source);
      assertSafeDom();
    }
  });

  it('renders the supported profile with semantic subordinate headings and valid list paragraphs', async () => {
    await render(
      '# Title\n\n## Section\n\n### Detail\n\n###### Deep\n\n**bold *em*** `code`\nnext  \nlast\n\n- tight\n  - nested\n\n3. loose\n\n4. second\n\n> quote\n\n```html arbitrary\n<script>literal</script>\n```\n\n    indented\n'
    );
    expect(root.querySelector('h3')?.textContent).toBe('Title');
    expect(root.querySelector('h4')?.textContent).toBe('Section');
    expect(root.querySelector('h5')?.textContent).toBe('Detail');
    expect(root.querySelector('h6')?.textContent).toBe('Deep');
    expect(root.querySelector('strong em')?.textContent).toBe('em');
    expect(root.querySelectorAll('br').length).toBe(2);
    expect(root.querySelector('ul > li > p')).toBeNull();
    expect(root.querySelector('ul ul > li')?.textContent).toBe('nested');
    expect(root.querySelector('ol')?.getAttribute('start')).toBe('3');
    expect(root.querySelector('ol > li > p')?.textContent).toBe('loose');
    expect(root.querySelector('blockquote p')?.textContent).toBe('quote');
    expect(root.querySelectorAll('pre code')[0]?.textContent).toBe('<script>literal</script>\n');
    expect(root.querySelectorAll('pre code')[1]?.textContent).toBe('indented\n');
    assertSafeDom();
  });

  it('does not insert extra spaces around inline formatting or adjacent text', async () => {
    await render('a**b**c *d*e`f`g');
    expect(root.querySelector('p')?.textContent).toBe('abc defg');
  });

  for (const source of [
    '<script>alert(1)</script><img src=x onerror=alert(1)>',
    '<svg onload=alert(1)><a xlink:href="javascript:alert(1)">x</a></svg>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="x"></object>',
    '<form><input autofocus onfocus=alert(1)></form><style>body{display:none}</style>',
    '&lt;img src=x onerror=alert(1)&gt;',
    '[unsafe](javascript:alert%281%29) [entity](java&#x73;cript:alert%281%29)',
    '[data](data:text/html,test) [file](file:///tmp/test) [mail](mailto:a@example.com)',
    '[relative](/local) [fragment](#id) [protocol relative](//evil.example)',
    '[credentials](https://user:pass@example.com) [backslash](https://example.com\\evil)',
    '![**alt** `code`](https://remote.example/asset "onerror=bad") ![](https://remote.example/empty)',
    '```html onmouseover=bad\n<iframe src=x></iframe>\n```',
    '| table | syntax |\n| --- | --- |\n\n- [x] task\n\n~~strike~~\n\n---\n\n**unfinished'
  ]) {
    it(`has an allowlisted DOM for adversarial input ${source.slice(0, 70)}`, async () => {
      await render(source);
      expect(root.textContent?.length).toBeGreaterThan(0);
      assertSafeDom();
      expect(root.querySelector('a')).toBeNull();
    });
  }

  it('renders images as alt text, not active markup or remote asset references', async () => {
    await render(
      '![**alt** `code`](https://remote.example/image) ![](https://remote.example/empty)'
    );
    expect(root.querySelector('p')?.textContent).toBe('alt code Image');
    expect(root.querySelector('p')?.children.length).toBe(0);
    expect(root.textContent).not.toContain('remote.example');
    assertSafeDom();
  });

  it('uses normal href bindings, safe external attributes and native same-origin navigation', async () => {
    await render(
      `[**external**](https://external.example/?a=1&amp;b=2 "ignored") [local](${location.origin}/work-items/123)`
    );
    const anchors = root.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    expect(anchors[0].href).toBe('https://external.example/?a=1&b=2');
    expect(anchors[0].target).toBe('_blank');
    expect(anchors[0].querySelector('strong')?.textContent).toBe('external');
    expect(anchors[1].hasAttribute('target')).toBeFalse();
    for (const anchor of Array.from(anchors)) {
      expect(anchor.rel).toBe('noopener noreferrer');
      expect(anchor.referrerPolicy).toBe('no-referrer');
      expect(anchor.hasAttribute('title')).toBeFalse();
    }
    assertSafeDom();
  });

  it('computes only when source or format changes and switches safely between formats', async () => {
    const parse = spyOn(MarkdownIt.prototype, 'parse').and.callThrough();
    await render('**bold**');
    fixture.detectChanges();
    fixture.detectChanges();
    expect(parse.calls.count()).toBe(1);
    await render('**bold**', 'plain_text');
    expect(root.querySelector('strong')).toBeNull();
    expect(root.querySelector('.plain-content')?.textContent).toBe('**bold**');
    expect(parse.calls.count()).toBe(1);
    await render('**next**');
    expect(root.querySelector('strong')?.textContent).toBe('next');
    expect(parse.calls.count()).toBe(2);
  });

  it('renders a parser failure as complete escaped source in the same region', async () => {
    spyOn(MarkdownIt.prototype, 'parse').and.throwError('parser failed');
    const source = '<script>bad()</script>\n**complete**';
    await render(source);
    expect(root.querySelector('.plain-content')?.textContent).toBe(source);
    assertSafeDom();
  });

  it('does not lose deeply nested source at the parser ceiling', async () => {
    const source = `${'> '.repeat(100)}tail <img src=x>`;
    await render(source);
    expect(root.querySelector('.plain-content')?.textContent).toBe(source);
    assertSafeDom();
  });

  it('wraps long text and URLs at narrow widths while containing literal code scrolling', async () => {
    await render(
      `${'longword'.repeat(80)}\n\n[${'longlabel'.repeat(50)}](https://example.com)\n\n\`\`\`\n${'longcode'.repeat(80)}\n\`\`\``
    );
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    const code = root.querySelector('pre')!;
    expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
    expect(code.getAttribute('tabindex')).toBe('0');
    expect(code.getAttribute('role')).toBe('region');
    expect(code.getAttribute('aria-label')).toBe('Code block');
    code.focus();
    expect(document.activeElement).toBe(code);
    await render('```\nshort\n```');
    expect(root.querySelector('pre')?.hasAttribute('tabindex')).toBeFalse();
    expect(root.querySelector('pre')?.hasAttribute('role')).toBeFalse();
  });

  it('adds no universal empty-state copy', async () => {
    await render('');
    expect(root.textContent?.trim()).toBe('');
    await render('', 'plain_text');
    expect(root.textContent?.trim()).toBe('');
  });
});
