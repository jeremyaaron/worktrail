import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import type {
  WorkItemRelationshipItemDto,
  WorkItemRelationshipType,
  WorkspaceWorkItemListItemDto
} from '@worktrail/contracts';
import { DraftDepartureCoordinator, draftRouteKey } from '../../core/navigation/draft-departure-coordinator';

import { WorkItemsApi } from '../../core/api/work-items-api';

import { WorkItemDetailStore } from './work-item-detail.store';
type RelationshipKind = 'blocked_by' | 'blocks' | 'related';
@Injectable()
export class WorkItemRelationshipsStore {
  readonly record = inject(WorkItemDetailStore);
  readonly managing = signal(false);
  readonly departure = inject(DraftDepartureCoordinator);
  private readonly workItemsApi = inject(WorkItemsApi);

  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly isSearchingCandidates = signal(false);

  readonly isAddingRelationship = signal(false);

  readonly removingRelationshipId = signal<string | null>(null);

  readonly hasSearchedRelationshipCandidates = signal(false);

  readonly relationshipError = signal<string | null>(null);

  readonly candidateSearchError = signal<string | null>(null);

  readonly relationshipCandidates = signal<WorkspaceWorkItemListItemDto[]>([]);

  readonly relationshipCandidatesHaveMore = signal(false);

  readonly relationshipForm = this.formBuilder.nonNullable.group({
    kind: ['blocked_by'],
    search: [''],
    targetWorkItemId: ['']
  });

  readonly linkedWorkItemIds = computed(() => {
    const relationships = this.record.workItem()?.relationships;

    if (relationships === undefined) {
      return new Set<string>();
    }

    return new Set([
      ...relationships.blockedBy.map((relationship) => relationship.workItem.id),
      ...relationships.blocks.map((relationship) => relationship.workItem.id),
      ...relationships.related.map((relationship) => relationship.workItem.id)
    ]);
  });

  searchRelationshipCandidates(): void {
    this.candidateSearchError.set(null);
    this.relationshipError.set(null);
    this.relationshipCandidatesHaveMore.set(false);
    this.hasSearchedRelationshipCandidates.set(true);
    this.relationshipForm.patchValue({ targetWorkItemId: '' }, { emitEvent: false });

    if (this.isRelationshipReadOnly()) {
      return;
    }

    const search = this.relationshipForm.getRawValue().search.trim();
    this.isSearchingCandidates.set(true);

    this.workItemsApi
      .listWorkspaceWorkItems(
        {
          search,
          archivedProjects: 'exclude',
          sort: 'updated_desc'
        },
        { page: 1, pageSize: 25 }
      )
      .pipe(this.record.context.guard())
      .subscribe({
        next: (response) => {
          this.relationshipCandidates.set(
            response.items.filter((candidate) => candidate.id !== this.record.workItemId())
          );
          this.relationshipCandidatesHaveMore.set(response.hasNextPage);
          this.isSearchingCandidates.set(false);
        },
        error: () => {
          this.candidateSearchError.set('Work item candidates could not be loaded.');
          this.relationshipCandidates.set([]);
          this.relationshipCandidatesHaveMore.set(false);
          this.isSearchingCandidates.set(false);
        }
      });
  }

  selectRelationshipCandidate(candidate: WorkspaceWorkItemListItemDto): void {
    if (this.isRelationshipReadOnly() || this.isAlreadyLinked(candidate.id)) {
      return;
    }

    this.relationshipError.set(null);
    this.relationshipForm.patchValue({ targetWorkItemId: candidate.id }, { emitEvent: false });
  }

  addRelationship(): void {
    this.relationshipError.set(null);

    if (this.isRelationshipReadOnly()) {
      return;
    }

    const formValue = this.relationshipForm.getRawValue();
    const targetWorkItemId = formValue.targetWorkItemId;

    if (targetWorkItemId === '') {
      this.relationshipError.set('Select a work item to link.');
      return;
    }

    if (this.isAlreadyLinked(targetWorkItemId)) {
      this.relationshipError.set('That work item is already linked.');
      return;
    }

    const kind = formValue.kind as RelationshipKind;
    const sourceWorkItemId = kind === 'blocked_by' ? targetWorkItemId : this.record.workItemId();
    const relationshipTargetWorkItemId =
      kind === 'blocked_by' ? this.record.workItemId() : targetWorkItemId;
    const relationshipType: WorkItemRelationshipType = kind === 'related' ? 'relates_to' : 'blocks';

    this.isAddingRelationship.set(true);
    this.workItemsApi
      .createWorkItemRelationship(sourceWorkItemId, {
        relationshipType,
        targetWorkItemId: relationshipTargetWorkItemId
      })
      .pipe(this.record.guardContext())
      .subscribe({
        next: () => {
          this.refreshAfterRelationshipMutation(() => {
            this.relationshipForm.patchValue({ targetWorkItemId: '' }, { emitEvent: false });
            this.isAddingRelationship.set(false);
          });
        },
        error: () => {
          this.relationshipError.set('The relationship could not be added.');
          this.isAddingRelationship.set(false);
        }
      });
  }

  removeRelationship(relationship: WorkItemRelationshipItemDto): void {
    this.relationshipError.set(null);

    if (this.isRelationshipReadOnly()) {
      return;
    }

    this.removingRelationshipId.set(relationship.id);
    this.workItemsApi
      .deleteWorkItemRelationship(this.record.workItemId(), relationship.id)
      .pipe(this.record.guardContext())
      .subscribe({
        next: () => {
          this.refreshAfterRelationshipMutation(() => {
            this.removingRelationshipId.set(null);
          });
        },
        error: () => {
          this.relationshipError.set('The relationship could not be removed.');
          this.removingRelationshipId.set(null);
        }
      });
  }

  isRelationshipReadOnly(): boolean {
    return this.record.isArchivedProject();
  }

  isAlreadyLinked(workItemId: string): boolean {
    return this.linkedWorkItemIds().has(workItemId);
  }

  relationshipActionLabel(): string {
    const kind = this.relationshipForm.getRawValue().kind as RelationshipKind;

    if (kind === 'blocked_by') {
      return 'Add blocker';
    }

    if (kind === 'blocks') {
      return 'Add blocked work';
    }

    return 'Add related work';
  }

  private refreshAfterRelationshipMutation(afterRefresh: () => void): void {
    this.workItemsApi
      .getWorkItem(this.record.workItemId())
      .pipe(this.record.context.guard())
      .subscribe({
        next: (workItem) => {
          this.record.workItem.update((current) =>
            current === null
              ? current
              : {
                ...current,
                relationships: workItem.relationships,
                dependencyBlocked: workItem.dependencyBlocked,
                openBlockerCount: workItem.openBlockerCount,
                openBlockedWorkCount: workItem.openBlockedWorkCount,
                updatedAt: workItem.updatedAt,
                activity: workItem.activity
              }
          );
          afterRefresh();
        },
        error: () => {
          this.relationshipError.set(
            'The relationship changed, but the latest detail could not be loaded.'
          );
          afterRefresh();
        }
      });
  }

  constructor() {
    effect(() => {
      const options = { emitEvent: false };
      if (this.record.isArchivedProject()) this.relationshipForm.disable(options);
      else this.relationshipForm.enable(options);
    });
  }

  reset(): void {
    this.managing.set(false);
    this.isSearchingCandidates.set(false);
    this.isAddingRelationship.set(false);
    this.hasSearchedRelationshipCandidates.set(false);
    this.relationshipCandidatesHaveMore.set(false);
    this.relationshipForm.reset({ kind: 'blocked_by', search: '', targetWorkItemId: '' });
  }

  registerDrafts(): void {
    this.departure.register({
      category: 'Dependency change', context: () => this.record.context.contextKey(),
      routeKey: () => draftRouteKey('detail', this.record.workItemId()),
      revision: () => 0, meaningful: () => false,
      pending: () => this.isAddingRelationship() || this.removingRelationshipId() !== null,
      discard: () => undefined
    }, this.destroyRef);
  }

}
