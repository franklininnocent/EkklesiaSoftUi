import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { SidebarNavNode } from './sidebar-nav.model';
import {
  accordionCloseSiblings,
  collapseNodeAndDescendants,
  collectAutoExpandIdsForForest,
  findParentId,
  findSiblingIds,
  resolveNavActivation,
} from './sidebar-nav.util';

@Injectable()
export class SidebarNavStateService {
  private readonly router = inject(Router);

  private readonly rootsSignal = signal<SidebarNavNode[]>([]);
  private readonly expandedIdsSignal = signal<Set<string>>(new Set());

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly activation = computed(() => resolveNavActivation(this.rootsSignal(), this.currentUrl()));

  readonly activeId = computed(() => this.activation().activeId);

  readonly ancestorIds = computed(() => this.activation().ancestorIds);

  readonly expandedIds = computed(() => this.expandedIdsSignal());

  constructor() {
    effect(() => {
      const url = this.currentUrl();
      const roots = this.rootsSignal();
      untracked(() => this.syncExpansionFromUrl(url, roots));
    });
  }

  setRoots(roots: SidebarNavNode[]): void {
    this.rootsSignal.set(roots);
  }

  isExpanded(nodeId: string): boolean {
    return this.expandedIdsSignal().has(nodeId);
  }

  isActive(nodeId: string): boolean {
    return this.activeId() === nodeId;
  }

  isAncestor(nodeId: string): boolean {
    return this.ancestorIds().has(nodeId);
  }

  toggleExpand(nodeId: string): void {
    const roots = this.rootsSignal();
    const next = new Set(this.expandedIdsSignal());

    if (next.has(nodeId)) {
      collapseNodeAndDescendants(next, roots, nodeId);
    } else {
      // User opened a branch: close competing siblings at this level, including
      // the previous active-ancestor branch. Keep ancestors of the opened node
      // (different level) so Donations stays open when Collect opens.
      const keep = new Set<string>();
      let parentId = findParentId(roots, nodeId);
      while (parentId) {
        keep.add(parentId);
        parentId = findParentId(roots, parentId);
      }
      accordionCloseSiblings(next, roots, nodeId, keep);
      next.add(nodeId);
    }

    this.expandedIdsSignal.set(next);
  }

  private syncExpansionFromUrl(url: string, roots: SidebarNavNode[]): void {
    if (!roots.length) {
      return;
    }

    const activation = resolveNavActivation(roots, url);
    const required = collectAutoExpandIdsForForest(roots, url);
    const current = this.expandedIdsSignal();
    const next = new Set(current);

    for (const id of required) {
      next.add(id);
    }

    const branchIds = new Set(required);
    if (activation.activeId) {
      branchIds.add(activation.activeId);
    }

    for (const id of [...next]) {
      if (branchIds.has(id)) {
        continue;
      }
      const parentId = findParentId(roots, id);
      const competing = findSiblingIds(roots, parentId).some((siblingId) => branchIds.has(siblingId));
      if (competing) {
        collapseNodeAndDescendants(next, roots, id);
      }
    }

    if (setsEqual(next, current)) {
      return;
    }

    this.expandedIdsSignal.set(next);
  }
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }
  return true;
}
