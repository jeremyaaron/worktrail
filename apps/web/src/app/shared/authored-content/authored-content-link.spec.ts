import { authoredContentLink, isExternalAuthoredContentLink } from './authored-content-link';

describe('authored-content links', () => {
  for (const value of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java&#x73;cript:alert(1)',
    'java%73cript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/file',
    'mailto:a@example.com',
    '//example.com/path',
    '/work-items/1',
    '#section',
    'example.com',
    ' https://example.com',
    'https://',
    'https:///example.com',
    'https:////example.com',
    'http://?query',
    'https://user:password@example.com',
    'https://user@example.com',
    'https://@example.com',
    'https://example.com\\evil',
    'https://example.com/\npath',
    'https://example.com/\tpath',
    'https://example.com/\u0000path',
    'https://example.com/\u007fpath',
    'https://example.com/\u0085path',
    'https://[bad]/',
    'https://example.com:99999',
    'https://exa mple.com',
    'https://exa%20mple.com',
    `https://example.com/${'a'.repeat(2048)}`
  ]) {
    it(`rejects ${JSON.stringify(value.slice(0, 90))}`, () => {
      expect(authoredContentLink(value)).toBeNull();
    });
  }

  it('serializes explicit HTTP(S), including mixed-case schemes and safe encoded path data', () => {
    expect(authoredContentLink('HTTPS://EXAMPLE.COM/a?b=1&c=2#d')).toBe(
      'https://example.com/a?b=1&c=2#d'
    );
    expect(authoredContentLink('http://localhost:4200/work-items/1')).toBe(
      'http://localhost:4200/work-items/1'
    );
    expect(authoredContentLink('https://example.com/%6aavascript:%0A%5C')).toBe(
      'https://example.com/%6aavascript:%0A%5C'
    );
  });

  it('checks both input and serialized URL lengths', () => {
    const prefix = 'https://example.com/';
    const exact = prefix + 'a'.repeat(2048 - prefix.length);
    expect(authoredContentLink(exact)).toBe(exact);
    expect(authoredContentLink(exact + 'a')).toBeNull();
    expect(authoredContentLink(prefix + '\u00e9'.repeat(400))).toBeNull();
  });

  it('compares scheme, host and port for native same-tab versus external navigation', () => {
    expect(
      isExternalAuthoredContentLink('https://example.com/other', 'https://example.com')
    ).toBeFalse();
    expect(isExternalAuthoredContentLink('http://example.com/', 'https://example.com')).toBeTrue();
    expect(
      isExternalAuthoredContentLink('https://example.com:444/', 'https://example.com')
    ).toBeTrue();
    expect(
      isExternalAuthoredContentLink('https://other.example/', 'https://example.com')
    ).toBeTrue();
  });
});
