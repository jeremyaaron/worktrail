import MarkdownIt from 'markdown-it';
import { parseAuthoredContent } from '../../src/app/shared/authored-content/authored-content-parser';

export function runContentBenchmark() {
  const samples = [
    [
      'ordinary prose',
      'Requirements include **review**, `code`, and readable source.\n\n'
        .repeat(200)
        .slice(0, 10_000)
    ],
    ['nested quotations', '> '.repeat(100) + 'tail'],
    ['delimiter heavy', '*_'.repeat(5_000)],
    ['dense lists', '- x\n'.repeat(2_500)],
    [
      'reference expansion',
      '[label][ref] '.repeat(40) + '\n\n[ref]: https://example.com/' + 'a'.repeat(1_800)
    ]
  ];
  const original = MarkdownIt.prototype.parse;
  let parserMs = 0;
  // Instrument only the standalone fixture, never the application parser or an Angular render.
  MarkdownIt.prototype.parse = function (...args: Parameters<typeof original>) {
    const start = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      parserMs += performance.now() - start;
    }
  };
  const percentile = (values: number[], fraction: number) => {
    const ordered = [...values].sort((a, b) => a - b);
    return Number(
      ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))].toFixed(3)
    );
  };
  try {
    return samples.map(([name, source]) => {
      const parsing: number[] = [];
      const projection: number[] = [];
      const total: number[] = [];
      let kind = '';
      for (let index = 0; index < 35; index++) {
        parserMs = 0;
        const start = performance.now();
        kind = parseAuthoredContent(source, 'markdown_v1').kind;
        const elapsed = performance.now() - start;
        if (index >= 5) {
          parsing.push(parserMs);
          projection.push(Math.max(0, elapsed - parserMs));
          total.push(elapsed);
        }
      }
      return {
        name,
        codeUnits: source.length,
        kind,
        samples: total.length,
        parserMedianMs: percentile(parsing, 0.5),
        parserP95Ms: percentile(parsing, 0.95),
        projectionPolicyMedianMs: percentile(projection, 0.5),
        projectionPolicyP95Ms: percentile(projection, 0.95),
        totalMedianMs: percentile(total, 0.5),
        totalP95Ms: percentile(total, 0.95),
        totalMaxMs: percentile(total, 1)
      };
    });
  } finally {
    MarkdownIt.prototype.parse = original;
  }
}

declare global {
  interface Window {
    runContentBenchmark: typeof runContentBenchmark;
  }
}
