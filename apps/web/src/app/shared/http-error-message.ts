interface ApiErrorBody {
  error?: {
    message?: unknown;
  };
}

export async function apiErrorMessageFromBody(
  body: unknown,
  fallback: string
): Promise<string> {
  const payload = body instanceof Blob ? await parseBlob(body) : body;
  const message = (payload as ApiErrorBody | null)?.error?.message;

  return typeof message === 'string' && message.trim() !== '' ? message : fallback;
}

async function parseBlob(blob: Blob): Promise<unknown> {
  try {
    return JSON.parse(await readBlobAsText(blob)) as unknown;
  } catch {
    return null;
  }
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}
