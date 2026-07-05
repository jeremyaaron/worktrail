import { extractApiErrorMessage } from './api-error';

describe('extractApiErrorMessage', () => {
  it('returns nested API error messages when present', () => {
    const message = extractApiErrorMessage(
      { error: { error: { message: '  Project key is already in use.  ' } } },
      'Fallback message.'
    );

    expect(message).toBe('Project key is already in use.');
  });

  it('returns top-level API body messages when present', () => {
    const message = extractApiErrorMessage(
      { error: { message: 'Workspace could not be updated.' } },
      'Fallback message.'
    );

    expect(message).toBe('Workspace could not be updated.');
  });

  it('falls back when an API message is missing or blank', () => {
    expect(extractApiErrorMessage({ error: { error: { message: ' ' } } }, 'Fallback.')).toBe(
      'Fallback.'
    );
    expect(extractApiErrorMessage(null, 'Fallback.')).toBe('Fallback.');
  });
});
