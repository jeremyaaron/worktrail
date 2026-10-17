import express, { type Express, type RequestHandler } from 'express';

export const jsonBodyLimits = {
  ordinary: 100 * 1024,
  csvImport: 6 * 1_048_576 + 4_096
} as const;

export const csvImportPaths = {
  preview: '/api/projects/:projectId/work-items/imports/preview',
  apply: '/api/projects/:projectId/work-items/imports'
} as const;

export function configureJsonParsing(app: Express, importsEnabled: boolean): void {
  if (importsEnabled) {
    const imports = express.Router();
    for (const path of Object.values(csvImportPaths)) imports.post(path, boundedJson(jsonBodyLimits.csvImport));
    app.use(imports);
  }
  app.use(boundedJson(jsonBodyLimits.ordinary));
}

function boundedJson(limit: number): RequestHandler {
  const parser = express.json({ limit, inflate: false });
  return (request, response, next) => {
    response.locals.jsonBodyLimitBytes = limit;
    parser(request, response, next);
  };
}
