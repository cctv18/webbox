import type {
  ActivityRecord,
  AdminStorageConfig,
  ApiResponse,
  BootstrapData,
  FileDetails,
  FileItem,
  MemoEntry,
  NotificationItem,
  PathMetadata,
  PluginManifest,
  RecycleRecord,
  SafeBoxStatus,
  TreeNode
  , WebboxSettings, TemplateFileType, FavoriteEntry, RecentSearch
} from "@webbox/shared";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" };
  const response = await fetch(url, { headers, ...init });
  const body = await response.json() as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

function withSpace(url: string, space?: string): string {
  if (!space) return url;
  return `${url}${url.includes("?") ? "&" : "?"}space=${encodeURIComponent(space)}`;
}

export const client = {
  bootstrap: () => api<BootstrapData>("/api/bootstrap"),
  settings: () => api<WebboxSettings>("/api/settings"),
  saveSettings: (settings: Partial<WebboxSettings>) => api<WebboxSettings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  plugins: () => api<PluginManifest[]>("/api/plugins"),
  tree: () => api<TreeNode[]>("/api/tree"),
  list: (path: string, space?: string) => api<FileItem[]>(withSpace(`/api/files?path=${encodeURIComponent(path)}`, space)),
  mkdir: (path: string, space?: string) => api<{ path: string }>("/api/files/folder", { method: "POST", body: JSON.stringify({ path, space }) }),
  writeText: (path: string, content: string, space?: string) => api<{ path: string }>("/api/files/text", { method: "POST", body: JSON.stringify({ path, content, space }) }),
  createTemplate: (path: string, type: TemplateFileType, space?: string) => api<{ path: string; type: TemplateFileType }>("/api/files/template", { method: "POST", body: JSON.stringify({ path, type, space }) }),
  rename: (path: string, name: string, space?: string) => api<{ path: string; name: string }>("/api/files/rename", { method: "POST", body: JSON.stringify({ path, name, space }) }),
  copy: (source: string, target: string, space?: string) => api<{ target: string }>("/api/files/copy", { method: "POST", body: JSON.stringify({ source, target, space }) }),
  move: (source: string, target: string, space?: string) => api<{ target: string }>("/api/files/move", { method: "POST", body: JSON.stringify({ source, target, space }) }),
  recycle: (path: string, space?: string) => api<{ recycleId: string }>("/api/files/recycle", { method: "POST", body: JSON.stringify({ path, space }) }),
  restore: (recycleId: string) => api<{ path: string }>("/api/files/restore", { method: "POST", body: JSON.stringify({ recycleId }) }),
  recycleList: () => api<RecycleRecord[]>("/api/recycle"),
  recycleDelete: (recycleId: string) => api<{ recycleId: string }>(`/api/recycle/${encodeURIComponent(recycleId)}`, { method: "DELETE" }),
  recycleClear: () => api<{ cleared: boolean }>("/api/recycle", { method: "DELETE" }),
  search: (path: string, q: string, space?: string) => api<FileItem[]>(withSpace(`/api/files/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(q)}`, space)),
  details: (path: string, space?: string) => api<FileDetails>(withSpace(`/api/files/details?path=${encodeURIComponent(path)}`, space)),
  upload: (path: string, file: File, space?: string) => {
    const body = new FormData();
    body.append("file", file);
    return api<{ name: string }>(withSpace(`/api/files/upload?path=${encodeURIComponent(path)}`, space), { method: "POST", body });
  },
  openUrl: (path: string, space?: string) => withSpace(`/api/files/open?path=${encodeURIComponent(path)}`, space),
  downloadUrl: (path: string, space?: string) => withSpace(`/api/files/download?path=${encodeURIComponent(path)}`, space),
  zip: (paths: string[], target: string, space?: string) => api<{ path: string }>("/api/files/zip", { method: "POST", body: JSON.stringify({ paths, target, space }) }),
  unzip: (path: string, targetDir: string, space?: string) => api<{ path: string }>("/api/files/unzip", { method: "POST", body: JSON.stringify({ path, targetDir, space }) }),
  favorites: () => api<FavoriteEntry[]>("/api/favorites"),
  addFavorite: (path: string, label: string) => api<FavoriteEntry>("/api/favorites", { method: "POST", body: JSON.stringify({ path, label }) }),
  removeFavorite: (id: string) => api<{ id: string }>(`/api/favorites/${encodeURIComponent(id)}`, { method: "DELETE" }),
  recentSearches: () => api<RecentSearch[]>("/api/search/recent"),
  addRecentSearch: (text: string, scope: string) => api<RecentSearch>("/api/search/recent", { method: "POST", body: JSON.stringify({ text, scope }) }),
  safeStatus: () => api<SafeBoxStatus>("/api/safe-box/status"),
  safeOpen: (password: string) => api<SafeBoxStatus>("/api/safe-box/open", { method: "POST", body: JSON.stringify({ password }) }),
  safeLogin: (password: string) => api<SafeBoxStatus>("/api/safe-box/login", { method: "POST", body: JSON.stringify({ password }) }),
  safeLogout: () => api<{ state: string }>("/api/safe-box/logout", { method: "POST", body: JSON.stringify({}) }),
  notifications: () => api<NotificationItem[]>("/api/notifications"),
  notificationRead: (id: string) => api<{ id: string }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({}) }),
  notificationsClear: () => api<{ cleared: boolean }>("/api/notifications", { method: "DELETE" }),
  activity: (path: string) => api<ActivityRecord[]>(`/api/metadata/activity?path=${encodeURIComponent(path)}`),
  properties: (path: string) => api<PathMetadata>(`/api/metadata/properties?path=${encodeURIComponent(path)}`),
  saveProperties: (value: PathMetadata) => api<PathMetadata>("/api/metadata/properties", { method: "POST", body: JSON.stringify(value) }),
  memos: (path: string) => api<MemoEntry[]>(`/api/metadata/memos?path=${encodeURIComponent(path)}`),
  addMemo: (path: string, content: string) => api<MemoEntry>("/api/metadata/memos", { method: "POST", body: JSON.stringify({ path, content }) }),
  updateMemo: (id: string, content: string) => api<MemoEntry>(`/api/metadata/memos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteMemo: (id: string) => api<{ id: string }>(`/api/metadata/memos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  storage: () => api<AdminStorageConfig>("/api/admin/storage"),
  saveStorage: (config: Partial<AdminStorageConfig>) => api<AdminStorageConfig>("/api/admin/storage", { method: "POST", body: JSON.stringify(config) })
};
