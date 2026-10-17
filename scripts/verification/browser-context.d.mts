export interface BrowserContext {
  kind: 'e2e' | 'preview' | 'editor';
  runId: string;
  checkout: string;
  port: number;
  apiPort?: number;
  token: string;
  baseURL: string;
  outputDir: string;
}
export function readBrowserContext(kind: BrowserContext['kind'], env?: NodeJS.ProcessEnv): Promise<BrowserContext>;
