import type { ApiResponse, BootstrapData, FileItem, PluginManifest } from "@webbox/shared";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" };
  const response = await fetch(url, { headers, ...init });
  const body = await response.json() as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

export const client = {
  bootstrap: () => api<BootstrapData>("/api/bootstrap"),
  plugins: () => api<PluginManifest[]>("/api/plugins"),
  list: (path: string) => api<FileItem[]>(`/api/files?path=${encodeURIComponent(path)}`),
  mkdir: (path: string) => api<{ path: string }>("/api/files/folder", { method: "POST", body: JSON.stringify({ path }) }),
  writeText: (path: string, content: string) => api<{ path: string }>("/api/files/text", { method: "POST", body: JSON.stringify({ path, content }) }),
  rename: (path: string, name: string) => api<{ path: string; name: string }>("/api/files/rename", { method: "POST", body: JSON.stringify({ path, name }) }),
  recycle: (path: string) => api<{ recycleId: string }>("/api/files/recycle", { method: "POST", body: JSON.stringify({ path }) }),
  search: (path: string, q: string) => api<FileItem[]>(`/api/files/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(q)}`)
};
