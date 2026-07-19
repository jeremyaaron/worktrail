import { ProjectBulkTriageStore } from './project-bulk-triage.store';

describe('ProjectBulkTriageStore', () => {
  it('ignores selection until bulk mode is active', () => {
    const store = new ProjectBulkTriageStore();

    store.toggleItem('work-1');
    store.toggleAllVisible([{ id: 'work-1' }, { id: 'work-2' }]);

    expect(store.selectedItemIds()).toEqual([]);

    store.enter();
    store.toggleItem('work-1');

    expect(store.isActive()).toBeTrue();
    expect(store.selectedItemIds()).toEqual(['work-1']);
  });

  it('toggles all visible rows and prunes hidden selections', () => {
    const store = new ProjectBulkTriageStore();
    const visibleRows = [{ id: 'work-1' }, { id: 'work-2' }];

    store.enter();
    store.toggleAllVisible(visibleRows);
    expect(store.selectedItemIds()).toEqual(['work-1', 'work-2']);
    expect(store.areAllVisibleSelected(visibleRows)).toBeTrue();
    expect(store.selectedVisibleCount(visibleRows)).toBe(2);

    store.pruneSelectionToVisible([{ id: 'work-2' }]);

    expect(store.selectedItemIds()).toEqual(['work-2']);
    expect(store.selectedVisibleItems(visibleRows)).toEqual([{ id: 'work-2' }]);
  });

  it('keeps failed rows selected after partial success', () => {
    const store = new ProjectBulkTriageStore();
    store.enter();
    store.toggleAllVisible([{ id: 'work-1' }, { id: 'work-2' }, { id: 'work-3' }]);
    store.beginApply();

    store.applySucceeded({
      requestedCount: 3,
      succeededCount: 1,
      unchangedCount: 1,
      failedCount: 1,
      results: [
        { workItemId: 'work-1', displayKey: 'WT-1', status: 'updated', workItem: null, error: null },
        { workItemId: 'work-2', displayKey: 'WT-2', status: 'unchanged', workItem: null, error: null },
        {
          workItemId: 'work-3',
          displayKey: 'WT-3',
          status: 'failed',
          workItem: null,
          error: {
            code: 'WORKFLOW_TRANSITION_ERROR',
            message: 'Cannot transition this work item.'
          }
        }
      ]
    });

    expect(store.isApplying()).toBeFalse();
    expect(store.selectedItemIds()).toEqual(['work-3']);
    expect(store.result()?.failedCount).toBe(1);
  });

  it('prunes failed selection to visible rows without clearing result feedback', () => {
    const store = new ProjectBulkTriageStore();
    store.enter();
    store.toggleAllVisible([{ id: 'work-1' }, { id: 'work-2' }]);
    store.beginApply();
    store.applySucceeded({
      requestedCount: 2,
      succeededCount: 0,
      unchangedCount: 0,
      failedCount: 2,
      results: [
        {
          workItemId: 'work-1',
          displayKey: 'WT-1',
          status: 'failed',
          workItem: null,
          error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'First failed.' }
        },
        {
          workItemId: 'work-2',
          displayKey: 'WT-2',
          status: 'failed',
          workItem: null,
          error: { code: 'WORKFLOW_TRANSITION_ERROR', message: 'Second failed.' }
        }
      ]
    });

    store.pruneSelectionToVisible([{ id: 'work-2' }]);

    expect(store.selectedItemIds()).toEqual(['work-2']);
    expect(store.result()?.failedCount).toBe(2);
    expect(store.result()?.results.map((result) => result.workItemId)).toEqual([
      'work-1',
      'work-2'
    ]);
  });

  it('exits mode and clears selection, apply state, errors, and result summaries', () => {
    const store = new ProjectBulkTriageStore();
    store.enter();
    store.toggleItem('work-1');
    store.beginApply();
    store.applyFailed('Bulk update failed.');

    store.exit();

    expect(store.isActive()).toBeFalse();
    expect(store.selectedItemIds()).toEqual([]);
    expect(store.isApplying()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.result()).toBeNull();
  });
});
