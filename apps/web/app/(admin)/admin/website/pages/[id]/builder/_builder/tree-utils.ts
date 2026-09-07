// Pure functions over a `StoredNode[]` tree — no React, no server calls.
// Every mutation returns a NEW array (structural sharing where a subtree is
// untouched) so the composer's undo/redo history can hold plain snapshots.
import type { StoredNode } from "@repo/contracts";

export function genNodeId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 24);
}

export function findNode(nodes: StoredNode[], id: string): StoredNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** The id of `id`'s parent node, or `null` when it's a root-level node (or not found at all). */
export function findParentId(
  nodes: StoredNode[],
  id: string,
  parentId: string | null = null,
): string | null {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    const found = findParentId(node.children, id, node.id);
    if (found !== null) return found;
  }
  return null;
}

/** Ids from the root down to (and including) `id` — the tree panel's indent/breadcrumb needs this, and "cannot nest a node inside itself" (replace-with, move) needs the same list. */
export function findPath(nodes: StoredNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node.id];
    if (node.id === id) return nextTrail;
    const found = findPath(node.children, id, nextTrail);
    if (found) return found;
  }
  return null;
}

/**
 * `Array.map` always allocates a new array even when every element is
 * unchanged — this only allocates when at least one element actually
 * differs (`Object.is`), so an untouched branch keeps its exact array
 * reference all the way up. Undo/redo snapshots and the tree panel's
 * re-render both benefit from that.
 */
function mapPreservingRef<T>(items: T[], fn: (item: T) => T): T[] {
  let changed = false;
  const mapped = items.map((item) => {
    const next = fn(item);
    if (!Object.is(next, item)) changed = true;
    return next;
  });
  return changed ? mapped : items;
}

/** Replaces the node matching `id` with `updater(node)`'s result — untouched subtrees keep their array references. */
export function updateNode(
  nodes: StoredNode[],
  id: string,
  updater: (node: StoredNode) => StoredNode,
): StoredNode[] {
  return mapPreservingRef(nodes, (node) => {
    if (node.id === id) return updater(node);
    const children = updateNode(node.children, id, updater);
    return children === node.children ? node : { ...node, children };
  });
}

export function removeNode(nodes: StoredNode[], id: string): StoredNode[] {
  const filtered = nodes.filter((node) => node.id !== id);
  return mapPreservingRef(filtered, (node) => {
    const children = removeNode(node.children, id);
    return children === node.children ? node : { ...node, children };
  });
}

/** Inserts `newNode` at `index` inside `parentId`'s children, or at the root when `parentId` is null. */
export function insertNode(
  nodes: StoredNode[],
  parentId: string | null,
  index: number,
  newNode: StoredNode,
): StoredNode[] {
  if (parentId === null) {
    const next = [...nodes];
    next.splice(index, 0, newNode);
    return next;
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = [...node.children];
      children.splice(index, 0, newNode);
      return { ...node, children };
    }
    if (node.children.length === 0) return node;
    const children = insertNode(node.children, parentId, index, newNode);
    return children === node.children ? node : { ...node, children };
  });
}

/** Swaps a node with its previous/next SIBLING (same array) — a no-op at either end. */
export function moveSibling(
  nodes: StoredNode[],
  id: string,
  direction: "up" | "down",
): StoredNode[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index !== -1) {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[target]] = [next[target] as StoredNode, next[index] as StoredNode];
    return next;
  }
  return nodes.map((node) =>
    node.children.length === 0
      ? node
      : (() => {
          const children = moveSibling(node.children, id, direction);
          return children === node.children ? node : { ...node, children };
        })(),
  );
}

/** Deep clone with every id (this node and every descendant) regenerated — copy/paste and duplicate both need a tree with no id collisions against the page it lands in. */
export function cloneWithFreshIds(node: StoredNode): StoredNode {
  return { ...node, id: genNodeId(), children: node.children.map(cloneWithFreshIds) };
}

export function countNodes(nodes: StoredNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
