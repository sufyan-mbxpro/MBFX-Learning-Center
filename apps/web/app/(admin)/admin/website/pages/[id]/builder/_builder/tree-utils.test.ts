import { describe, expect, it } from "vitest";
import type { StoredNode } from "@repo/contracts";
import {
  cloneWithFreshIds,
  countNodes,
  findNode,
  findPath,
  insertNode,
  moveSibling,
  removeNode,
  updateNode,
} from "./tree-utils.ts";

function n(id: string, children: StoredNode[] = []): StoredNode {
  return { type: "section", version: 1, id, props: {}, hidden: false, children };
}

describe("findNode / findPath", () => {
  const tree = [n("a", [n("b"), n("c", [n("d")])])];

  it("finds a top-level and a deeply nested node", () => {
    expect(findNode(tree, "a")?.id).toBe("a");
    expect(findNode(tree, "d")?.id).toBe("d");
    expect(findNode(tree, "missing")).toBeNull();
  });

  it("returns the full root-to-node id trail", () => {
    expect(findPath(tree, "d")).toEqual(["a", "c", "d"]);
    expect(findPath(tree, "missing")).toBeNull();
  });
});

describe("updateNode — untouched subtrees keep their array reference", () => {
  it("replaces only the matching node", () => {
    const tree = [n("a", [n("b")])];
    const next = updateNode(tree, "b", (node) => ({ ...node, label: "renamed" }));
    expect(findNode(next, "b")?.label).toBe("renamed");
    expect(next).not.toBe(tree);
  });

  it("does not touch a sibling subtree's array identity", () => {
    const untouched = n("c", [n("d")]);
    const tree = [n("a", [n("b")]), untouched];
    const next = updateNode(tree, "b", (node) => ({ ...node, hidden: true }));
    expect(next[1]).toBe(untouched);
  });
});

describe("removeNode", () => {
  it("removes a nested node and everything under it", () => {
    const tree = [n("a", [n("b", [n("e")]), n("c")])];
    const next = removeNode(tree, "b");
    expect(findNode(next, "b")).toBeNull();
    expect(findNode(next, "e")).toBeNull();
    expect(findNode(next, "c")).not.toBeNull();
  });
});

describe("insertNode", () => {
  it("inserts at the root at the given index", () => {
    const tree = [n("a"), n("c")];
    const next = insertNode(tree, null, 1, n("b"));
    expect(next.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("inserts inside a parent's children", () => {
    const tree = [n("a", [n("x")])];
    const next = insertNode(tree, "a", 1, n("y"));
    expect(findNode(next, "a")?.children.map((c) => c.id)).toEqual(["x", "y"]);
  });
});

describe("moveSibling", () => {
  it("swaps with the previous sibling, no-ops at the start", () => {
    const tree = [n("a"), n("b"), n("c")];
    const moved = moveSibling(tree, "b", "up");
    expect(moved.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(moveSibling(tree, "a", "up").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("swaps with the next sibling, no-ops at the end", () => {
    const tree = [n("a"), n("b"), n("c")];
    expect(moveSibling(tree, "b", "down").map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(moveSibling(tree, "c", "down").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("moves within a nested parent's children, not just the root", () => {
    const tree = [n("a", [n("x"), n("y")])];
    const next = moveSibling(tree, "y", "up");
    expect(findNode(next, "a")?.children.map((c) => c.id)).toEqual(["y", "x"]);
  });
});

describe("cloneWithFreshIds", () => {
  it("regenerates every id in the subtree, with no collisions against the original", () => {
    const original = n("a", [n("b", [n("c")])]);
    const clone = cloneWithFreshIds(original);
    expect(clone.id).not.toBe("a");
    expect(clone.children[0]?.id).not.toBe("b");
    expect(clone.children[0]?.children[0]?.id).not.toBe("c");
    // Structure (shape, not ids) is preserved.
    expect(clone.children).toHaveLength(1);
    expect(clone.children[0]?.children).toHaveLength(1);
  });
});

describe("countNodes", () => {
  it("counts every node in the tree, including nested ones", () => {
    expect(countNodes([n("a", [n("b"), n("c", [n("d")])])])).toBe(4);
    expect(countNodes([])).toBe(0);
  });
});
