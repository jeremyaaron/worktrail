export function authoredContentLink(value: string): string | null {
  const authority = /^https?:\/\/([^/?#]+)/iu.exec(value)?.[1];
  if (
    value.length > 2048 ||
    // URL parsing otherwise silently removes some controls and repairs backslashes.
    /[\p{Cc}\\]/u.test(value) ||
    !authority ||
    /[\s@]/u.test(authority)
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.hostname.includes('%') ||
      url.username ||
      url.password ||
      url.href.length > 2048
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function isExternalAuthoredContentLink(href: string, origin: string): boolean {
  return new URL(href).origin !== origin;
}
