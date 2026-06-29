import path from "node:path";
export function normalizeVirtualPath(input) {
    const raw = input.trim() || "/";
    const segments = raw.replace(/\\/g, "/").split("/");
    if (segments.some((segment) => segment === "..")) {
        throw new Error("PATH_OUTSIDE_ROOT");
    }
    const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
    return path.posix.normalize(prefixed.replace(/\\/g, "/"));
}
export function resolveInsideRoot(root, virtualPath) {
    const rootAbs = path.resolve(root);
    const normalized = normalizeVirtualPath(virtualPath);
    const target = path.resolve(rootAbs, `.${normalized}`);
    const relative = path.relative(rootAbs, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("PATH_OUTSIDE_ROOT");
    }
    return target;
}
export function toVirtualPath(root, absolutePath) {
    const rootAbs = path.resolve(root);
    const target = path.resolve(absolutePath);
    const relative = path.relative(rootAbs, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("PATH_OUTSIDE_ROOT");
    }
    const normalized = relative.split(path.sep).filter(Boolean).join("/");
    return normalized ? `/${normalized}` : "/";
}
