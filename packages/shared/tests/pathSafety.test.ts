import { describe, expect, it } from "vitest";
import path from "node:path";
import { assertSafeFileName, normalizeVirtualPath, resolveInsideRoot, splitAbstractPath, toVirtualPath } from "../src/pathSafety.js";

describe("path safety", () => {
  const root = path.resolve(process.cwd(), ".test-root");

  it("resolves a virtual path inside the root", () => {
    expect(resolveInsideRoot(root, "/docs/readme.txt")).toBe(path.join(root, "docs", "readme.txt"));
  });

  it("rejects traversal outside the root", () => {
    expect(() => resolveInsideRoot(root, "/../secret.txt")).toThrow("PATH_OUTSIDE_ROOT");
  });

  it("rejects windows separators, drive prefixes, unc paths, and traversal in abstract paths", () => {
    expect(() => splitAbstractPath("docs\\nested\\file.txt")).toThrow("INVALID_PATH");
    expect(() => splitAbstractPath("C:/Windows")).toThrow("INVALID_PATH");
    expect(() => splitAbstractPath("\\\\server\\share")).toThrow("INVALID_PATH");
    expect(() => splitAbstractPath("/docs/%2e%2e/secret.txt")).toThrow("INVALID_PATH");
  });

  it("rejects reserved or unsafe filenames", () => {
    expect(() => assertSafeFileName("CON")).toThrow("INVALID_NAME");
    expect(() => assertSafeFileName("bad/name.txt")).toThrow("INVALID_NAME");
    expect(() => assertSafeFileName("bad:name.txt")).toThrow("INVALID_NAME");
    expect(assertSafeFileName("readme.md")).toBe("readme.md");
  });

  it("converts absolute paths back to virtual paths", () => {
    expect(toVirtualPath(root, path.join(root, "a", "b.txt"))).toBe("/a/b.txt");
  });
});
