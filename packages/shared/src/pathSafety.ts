import path from "node:path";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const INVALID_FILENAME_CHARS = /[<>:"|?*]/;

export function splitAbstractPath(input: string): string[] {
  const raw = String(input ?? "").trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw || "/");
  } catch {
    throw new Error("INVALID_PATH");
  }
  if (!decoded.startsWith("/") || decoded.includes("\\") || /^[a-zA-Z]:/.test(decoded) || decoded.startsWith("//")) {
    throw new Error("INVALID_PATH");
  }
  const parts = decoded.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "." || part === ".." || CONTROL_CHARS.test(part)) {
      throw new Error("INVALID_PATH");
    }
  }
  return parts;
}

export function assertSafeFileName(name: string): string {
  const value = String(name ?? "").trim();
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error("INVALID_NAME");
  }
  if (CONTROL_CHARS.test(value) || INVALID_FILENAME_CHARS.test(value) || WINDOWS_RESERVED.test(value)) {
    throw new Error("INVALID_NAME");
  }
  return value;
}

export function normalizeVirtualPath(input: string): string {
  const raw = input.trim() || "/";
  if (raw.includes("\\") || /^[a-zA-Z]:/.test(raw) || raw.startsWith("//")) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }
  const segments = raw.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || CONTROL_CHARS.test(segment))) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }
  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  return path.posix.normalize(prefixed);
}

export function resolveInsideRoot(root: string, virtualPath: string): string {
  const rootAbs = path.resolve(root);
  const normalized = normalizeVirtualPath(virtualPath);
  const target = path.resolve(rootAbs, `.${normalized}`);
  const relative = path.relative(rootAbs, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }
  return target;
}

export function toVirtualPath(root: string, absolutePath: string): string {
  const rootAbs = path.resolve(root);
  const target = path.resolve(absolutePath);
  const relative = path.relative(rootAbs, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PATH_OUTSIDE_ROOT");
  }
  const normalized = relative.split(path.sep).filter(Boolean).join("/");
  return normalized ? `/${normalized}` : "/";
}
