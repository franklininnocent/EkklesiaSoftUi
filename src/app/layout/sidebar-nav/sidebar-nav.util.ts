import { NavActivation, SidebarNavNode } from './sidebar-nav.model';

/** Strip query/hash and optional `/tenant/:id` prefix for matching. */
export function normalizeUrl(url: string): string {
  const path = url.split('?')[0].split('#')[0];
  const tenantMatch = path.match(/^\/tenant\/[^/]+(\/.*)?$/);
  if (tenantMatch) {
    return tenantMatch[1] || '/';
  }
  return path || '/';
}

export function parseNavigationUrl(url: string): { path: string; query: Record<string, string> } {
  const withoutHash = url.split('#')[0];
  const queryIndex = withoutHash.indexOf('?');
  const pathRaw = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const queryPart = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
  const query: Record<string, string> = {};

  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      if (!pair) {
        continue;
      }
      const [key, value = ''] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }
  }

  return { path: normalizeUrl(pathRaw), query };
}

function queryMatchScore(node: SidebarNavNode, url: string): number {
  if (!node.query) {
    return 0;
  }

  const { query } = parseNavigationUrl(url);
  let score = 0;

  for (const [key, value] of Object.entries(node.query)) {
    if (query[key] === value) {
      score += 2;
      continue;
    }
    if (node.defaultWhenQueryMissing?.[key] === value && !query[key]) {
      score += 1;
    }
  }

  return score;
}

/** Boundary-safe path match (avoids `/donations/projects` matching `/donations/project-installments`). */
export function pathMatches(url: string, path: string, exact = false): boolean {
  const normalized = normalizeUrl(url);
  const target = path.split('?')[0].split('#')[0];

  if (exact) {
    return normalized === target;
  }

  return (
    normalized === target ||
    normalized.startsWith(`${target}/`) ||
    normalized.startsWith(`${target}?`)
  );
}

export function nodeMatchesUrl(node: SidebarNavNode, url: string): boolean {
  if (!node.route) {
    return false;
  }

  const { path, query } = parseNavigationUrl(url);
  const routePath = node.route.split('?')[0];

  if (!pathMatches(path, routePath, node.exact ?? false)) {
    return false;
  }

  if (!node.query) {
    return true;
  }

  return queryMatchScore(node, url) > 0;
}

export function isCrossLink(node: SidebarNavNode): boolean {
  return node.crossLink === true || node.excludeFromAutoExpand === true;
}

interface MatchCandidate {
  nodeId: string;
  routeLength: number;
  queryScore: number;
  crossLink: boolean;
  ancestorIds: string[];
}

/**
 * Resolve exactly one ACTIVE leaf and its ancestor trail from the visible forest.
 * Longest matching route wins; cross-links lose to canonical owners.
 */
export function resolveNavActivation(roots: SidebarNavNode[], url: string): NavActivation {
  const candidates: MatchCandidate[] = [];

  function walk(node: SidebarNavNode, ancestors: string[]): void {
    if (node.route && nodeMatchesUrl(node, url)) {
      candidates.push({
        nodeId: node.id,
        routeLength: node.route.split('?')[0].length,
        queryScore: queryMatchScore(node, url),
        crossLink: isCrossLink(node),
        ancestorIds: [...ancestors],
      });
    }
    for (const child of node.children ?? []) {
      walk(child, [...ancestors, node.id]);
    }
  }

  for (const root of roots) {
    walk(root, []);
  }

  if (candidates.length === 0) {
    return { activeId: null, ancestorIds: new Set() };
  }

  const hasPrimary = candidates.some((candidate) => !candidate.crossLink);
  const pool = hasPrimary ? candidates.filter((candidate) => !candidate.crossLink) : candidates;
  const winner = pool.reduce((best, candidate) => {
    if (candidate.routeLength !== best.routeLength) {
      return candidate.routeLength > best.routeLength ? candidate : best;
    }
    return candidate.queryScore > best.queryScore ? candidate : best;
  });

  return {
    activeId: winner.nodeId,
    ancestorIds: new Set(winner.ancestorIds),
  };
}

/** Collect ids of ancestors that should auto-expand for the current URL (per root tree). */
export function collectAutoExpandIds(root: SidebarNavNode, url: string): Set<string> {
  const activation = resolveNavActivation([root], url);
  if (!activation.activeId) {
    return new Set();
  }

  const activeNode = findNodeById([root], activation.activeId);
  if (activeNode && isCrossLink(activeNode)) {
    return new Set();
  }

  return new Set(activation.ancestorIds);
}

export function collectAutoExpandIdsForForest(roots: SidebarNavNode[], url: string): Set<string> {
  const activation = resolveNavActivation(roots, url);
  if (!activation.activeId) {
    return new Set();
  }

  const activeNode = findNodeById(roots, activation.activeId);
  if (activeNode && isCrossLink(activeNode)) {
    return new Set();
  }

  return new Set(activation.ancestorIds);
}

export function findParentId(
  roots: SidebarNavNode[],
  nodeId: string,
  parentId: string | null = null
): string | null {
  for (const root of roots) {
    const found = findParentIdInTree(root, nodeId, parentId);
    if (found !== undefined) {
      return found;
    }
  }
  return null;
}

function findParentIdInTree(
  node: SidebarNavNode,
  nodeId: string,
  parentId: string | null
): string | null | undefined {
  if (node.id === nodeId) {
    return parentId;
  }
  for (const child of node.children ?? []) {
    const found = findParentIdInTree(child, nodeId, node.id);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * Siblings at one hierarchy level. Forest roots (parentId null) compete with each other.
 */
export function findSiblingIds(
  roots: SidebarNavNode[],
  parentId: string | null,
  excludeId?: string
): string[] {
  const peers = parentId ? findNodeById(roots, parentId)?.children ?? [] : roots;
  return peers.filter((child) => child.id !== excludeId).map((child) => child.id);
}

export function collectDescendantIds(node: SidebarNavNode): string[] {
  const ids: string[] = [];
  for (const child of node.children ?? []) {
    ids.push(child.id, ...collectDescendantIds(child));
  }
  return ids;
}

/** Remove a node and every descendant from the expanded set. */
export function collapseNodeAndDescendants(
  expanded: Set<string>,
  roots: SidebarNavNode[],
  nodeId: string
): void {
  expanded.delete(nodeId);
  const node = findNodeById(roots, nodeId);
  if (!node) {
    return;
  }
  for (const descendantId of collectDescendantIds(node)) {
    expanded.delete(descendantId);
  }
}

/**
 * Same-level accordion: at most one expanded child per parent.
 * `keepIds` are protected (active ancestor trail and/or the node just opened).
 */
export function accordionCloseSiblings(
  expanded: Set<string>,
  roots: SidebarNavNode[],
  nodeId: string,
  keepIds: Set<string>
): void {
  const parentId = findParentId(roots, nodeId);
  for (const siblingId of findSiblingIds(roots, parentId, nodeId)) {
    if (keepIds.has(siblingId)) {
      continue;
    }
    collapseNodeAndDescendants(expanded, roots, siblingId);
  }
}

export function findNodeById(roots: SidebarNavNode[], nodeId: string): SidebarNavNode | null {
  for (const root of roots) {
    const found = findNodeInTree(root, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findNodeInTree(node: SidebarNavNode, nodeId: string): SidebarNavNode | null {
  if (node.id === nodeId) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = findNodeInTree(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

/** @deprecated Use resolveNavActivation. */
export function findMatchingNodeId(root: SidebarNavNode, url: string): string | null {
  return resolveNavActivation([root], url).activeId;
}

/** @deprecated Use resolveNavActivation ancestorIds. */
export function isSectionActive(node: SidebarNavNode, url: string, root: SidebarNavNode): boolean {
  const activation = resolveNavActivation([root], url);
  return activation.ancestorIds.has(node.id);
}

export function flattenForest(sections: { items: SidebarNavNode[] }[]): SidebarNavNode[] {
  return sections.flatMap((section) => section.items);
}
