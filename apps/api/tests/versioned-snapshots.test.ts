import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { ProjectStatusReportSnapshotV1Dto } from '@worktrail/contracts';
import { ConflictError, ValidationError } from '../src/errors/app-error.js';
import { assertProjectStatusReportSnapshotMatchesRecord, parseRequestedProjectStatusReportSnapshot, parseStoredProjectStatusReportSnapshot } from '../src/validation/project-status-report-snapshot.js';
import { assertProjectCycleCloseoutSnapshotMatchesRecord, parseRequestedProjectCycleCloseoutSnapshot, parseStoredProjectCycleCloseoutSnapshot } from '../src/validation/project-cycle-closeout-snapshot.js';
import { goldenCloseoutV1, goldenCloseoutV2, goldenReportV1, goldenReportV2, goldenReportRecord } from './support/snapshot-fixtures.js';
import { renderStatusReportMarkdown } from '../src/services/status-report-markdown-renderer.js';

describe('frozen report and closeout versions', () => {
  it('keeps golden v1 Markdown byte-for-byte equal to the pre-phase renderer', async () => {
    const expected = await readFile(new URL('./fixtures/status-report-v1.md', import.meta.url), 'utf8');
    expect(renderStatusReportMarkdown(goldenReportRecord())).toBe(expected);
  });
  it('renders v2 units and exact current-work links without changing the v1 data', () => {
    const before = JSON.stringify(goldenReportV1);
    const markdown = renderStatusReportMarkdown(goldenReportRecord({ snapshot: goldenReportV2() }));
    expect(markdown).toContain('1 work item');
    expect(markdown).toContain('estimateState=unestimated');
    expect(markdown).toContain('workState=open');
    expect(JSON.stringify(goldenReportV1)).toBe(before);
  });
  it('retains golden v1 data without adding units or rewriting historical queries', () => {
    expect(parseStoredProjectStatusReportSnapshot(goldenReportV1)).toEqual(goldenReportV1);
    expect(parseStoredProjectCycleCloseoutSnapshot(goldenCloseoutV1)).toEqual(goldenCloseoutV1);
    expect(parseRequestedProjectStatusReportSnapshot(goldenReportV1)).toEqual(goldenReportV1);
    expect(parseRequestedProjectCycleCloseoutSnapshot(goldenCloseoutV1)).toEqual(goldenCloseoutV1);
    expect(JSON.stringify(goldenCloseoutV1)).not.toMatch(/countUnit|estimateState/);
  });
  it('preserves report v1 stripping and optional fields, rather than making it strict', () => {
    const value = { ...goldenReportV1, extra: true, risks: goldenReportV1.risks.map(risk => ({ ...risk,
      query: { ...risk.query, estimateState: 'unestimated', hierarchy: 'children', parentKey: 'WT-42' } })) };
    expect(parseStoredProjectStatusReportSnapshot(value)).toEqual(goldenReportV1);
    const withoutParent: ProjectStatusReportSnapshotV1Dto = structuredClone(goldenReportV1);
    delete withoutParent.recentWork[0]!.parent;
    expect(parseStoredProjectStatusReportSnapshot(withoutParent)).toEqual(withoutParent);
  });
  it('preserves strict closeout v1 query/health shapes', () => {
    const value = structuredClone(goldenCloseoutV1);
    Object.assign(value.health.reasons[0]!.query!, { estimateState: 'unestimated' });
    expect(() => parseStoredProjectCycleCloseoutSnapshot(value)).toThrow(ConflictError);
    expect(() => parseStoredProjectCycleCloseoutSnapshot({ ...goldenCloseoutV1, extra: true })).toThrow(ConflictError);
  });
  it('reads v2 with precise open/unestimated cycle queries and explicit units', () => {
    const report = goldenReportV2(), closeout = goldenCloseoutV2();
    expect(parseStoredProjectStatusReportSnapshot(report)).toEqual(report);
    expect(parseStoredProjectCycleCloseoutSnapshot(closeout)).toEqual(closeout);
    expect(report.cycle?.links[0]?.query).toMatchObject({ estimateState: 'unestimated', workState: 'open', cycleId: closeout.cycle.id });
  });
  it.each([0, 3, '2', null])('rejects unsupported or incorrectly typed version %s safely', (version) => {
    expect(() => parseRequestedProjectStatusReportSnapshot({ ...goldenReportV1, snapshotVersion: version })).toThrow(ValidationError);
    expect(() => parseStoredProjectStatusReportSnapshot({ ...goldenReportV1, snapshotVersion: version })).toThrow(ConflictError);
    expect(() => parseRequestedProjectCycleCloseoutSnapshot({ ...goldenCloseoutV1, snapshotVersion: version })).toThrow(ValidationError);
    expect(() => parseStoredProjectCycleCloseoutSnapshot({ ...goldenCloseoutV1, snapshotVersion: version })).toThrow(ConflictError);
  });
  it('requires v2 units and refuses unsupported/new/conflicting frozen query fields', () => {
    const snapshot = goldenCloseoutV2();
    delete (snapshot.health.reasons[0] as Partial<typeof snapshot.health.reasons[number]>).countUnit;
    expect(() => parseStoredProjectCycleCloseoutSnapshot(snapshot)).toThrow(ConflictError);
    for (const query of [
      { estimateState: 'unknown' }, { futureRisk: true }, { status: 'ready', workState: 'open' },
      { hierarchy: 'children', parentKey: 'WT-42' }, { assigneeId: goldenCloseoutV1.closedBy.id, assigneeState: 'unassigned' }
    ]) {
      const report = goldenReportV2();
      Object.assign(report.risks[0]!.query, query);
      expect(() => parseStoredProjectStatusReportSnapshot(report)).toThrow(ConflictError);
    }
  });
  it('does not accept an imprecise v2 unestimated reason', () => {
    const snapshot = goldenCloseoutV2();
    const reason = snapshot.health.reasons.find(reason => reason.key === 'unestimated_work')!;
    delete reason.query!.estimateState;
    expect(() => parseStoredProjectCycleCloseoutSnapshot(snapshot)).toThrow(ConflictError);
  });
  it('retains count/category refinements in v2', () => {
    const snapshot = goldenCloseoutV2();
    snapshot.counts.unestimatedUnfinishedCount = 0;
    expect(() => parseStoredProjectCycleCloseoutSnapshot(snapshot)).toThrow(ConflictError);
  });
  it('checks record bindings for either stored version', () => {
    for (const snapshot of [goldenReportV1, goldenReportV2()]) {
      expect(() => assertProjectStatusReportSnapshotMatchesRecord(snapshot, { projectId: 'other-project' })).toThrow(ConflictError);
    }
    for (const snapshot of [goldenCloseoutV1, goldenCloseoutV2()]) {
      expect(() => assertProjectCycleCloseoutSnapshotMatchesRecord(snapshot, { projectId: snapshot.project.id,
        cycleId: 'other-cycle', destinationCycleId: snapshot.destination.kind === 'cycle' ? snapshot.destination.cycle.id : null })).toThrow(ConflictError);
    }
  });
});
