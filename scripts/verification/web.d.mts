export function readWebTestContext(env?: Record<string, string | undefined>): Promise<{
  port: number;
  cacheDir: string;
  reportPath: string;
  screenshotDirectory: string;
}>;
