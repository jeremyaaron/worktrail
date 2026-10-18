import type { ProjectCycleCloseoutDto } from '@worktrail/contracts';

function literal(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1').replace(/[\r\n]+/g, ' ');
}

// Export the authorized stored snapshot, never current assignments or the visible page.
export function closeoutMarkdown(closeout: ProjectCycleCloseoutDto): string {
  const snapshot = closeout.snapshot;
  const destination = snapshot.destination.kind === 'cycle'
    ? snapshot.destination.cycle.name : snapshot.destination.kind === 'unplanned' ? 'Unplanned' : 'None';
  const lines = [
    '# ' + literal(snapshot.cycle.name),
    '',
    literal(snapshot.project.key + ' / ' + snapshot.project.name),
    '',
    '## Outcome at close',
    '',
    `Closed ${literal(snapshot.closedAt)} by ${literal(snapshot.closedBy.name)}. Snapshot v${snapshot.snapshotVersion}.`,
    '',
    `Dates: ${snapshot.cycle.startDate} - ${snapshot.cycle.endDate}.`,
    `Goal: ${literal(snapshot.cycle.goal)}`,
    `Destination at close: ${literal(destination)}.`,
    '',
    ...Object.entries(snapshot.counts).map(([key, count]) => `- ${key}: ${count}`),
    ''
  ];
  for (const [key, title] of [['completed', 'Done at close'], ['canceled', 'Canceled at close'], ['unfinished', 'Unfinished at close']] as const) {
    const items = snapshot.items[key];
    lines.push(`## ${title} (${items.length})`, '');
    for (const item of items) {
      lines.push(`- ${literal(item.displayKey)}: ${literal(item.title)} - ${item.status}; ${item.priority}; ${literal(item.assignee?.name ?? 'Unassigned')}; ${item.estimatePoints ?? 'unestimated'}${item.estimatePoints === null ? '' : ' points'}; dependency blocked: ${item.dependencyBlocked ? 'yes' : 'no'}`);
    }
    if (items.length === 0) lines.push('No items.');
    lines.push('');
  }
  // A variable fence keeps arbitrary authored text inside the literal evidence block.
  const json = JSON.stringify(snapshot, null, 2);
  let fenceLength = 3;
  for (const match of json.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
  const fence = '`'.repeat(fenceLength);
  lines.push('## Complete stored evidence', '', fence + 'json', json, fence, '');
  return lines.join('\n');
}
