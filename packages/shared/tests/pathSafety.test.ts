import { describe, expect, it } from "vitest";
import path from "node:path";
import { normalizeVirtualPath, resolveInsideRoot, toVirtualPath } from "../src/pathSafety.js";

describe("path safety", () => {
  const root = path.resolve("H:/oplus/kodbox/webbox/.test-root");

  it("resolves a virtual path inside the root", () => {
    expect(resolveInsideRoot(root, "/docs/readme.txt")).toBe(path.join(root, "docs", "readme.txt"));
  });

  it("rejects traversal outside the root", () => {
    expect(() => resolveInsideRoot(root, "/../secret.txt")).toThrow("PATH_OUTSIDE_ROOT");
  });

  it("normalizes windows separators and relative values", () => {
    expect(normalizeVirtualPath("docs\\nested\\file.txt")).toBe("/docs/nested/file.txt");
  });

  it("converts absolute paths back to virtual paths", () => {
    expect(toVirtualPath(root, path.join(root, "a", "b.txt"))).toBe("/a/b.txt");
  });
});
