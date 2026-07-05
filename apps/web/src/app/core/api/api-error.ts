export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const message = candidateMessage(error);

  return message === undefined ? fallback : message;
}

function candidateMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return undefined;
  }

  const errorBody = (error as { error?: unknown }).error;

  if (typeof errorBody === 'object' && errorBody !== null) {
    const nestedError = (errorBody as { error?: unknown }).error;

    if (typeof nestedError === 'object' && nestedError !== null) {
      const nestedMessage = messageValue((nestedError as { message?: unknown }).message);

      if (nestedMessage !== undefined) {
        return nestedMessage;
      }
    }

    return messageValue((errorBody as { message?: unknown }).message);
  }

  return messageValue(errorBody);
}

function messageValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}
