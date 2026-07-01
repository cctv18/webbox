export type FileKind = "file" | "directory";
export type TreeSection = "locations" | "tools" | "mounts";
export type NotificationLevel = "info" | "success" | "warning" | "error";
export type SafeBoxState = "notOpen" | "locked" | "unlocked";
export type ViewMode = "list" | "grid";
export type SortKey = "name" | "type" | "size" | "modifiedAt";
export type SortDirection = "asc" | "desc";
export type TemplateFileType = "txt" | "md" | "html" | "docx" | "xlsx" | "pptx";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export interface ExplorerPreferences {
  theme: "light" | "dark" | "system";
  language: "zh-CN" | "en-US";
  viewMode: ViewMode;
  iconSize: number;
  sort: SortState;
  searchHistoryLimit: number;
  currentPath: string;
  expandedTreeIds: string[];
  historyBack: string[];
  historyForward: string[];
}

export interface WebboxSettings {
  explorer: ExplorerPreferences;
  upload: {
    chunkSizeMb: number;
    concurrency: number;
    ignorePatterns: string[];
    retryCount: number;
  };
  download: {
    speedLimitKb: number;
    frontendZip: boolean;
    backendZipSizeLimitMb: number;
  };
}

export interface ResolvedLocation {
  kind: "space" | "virtual" | "recycle" | "mount";
  displayPath: string;
  space?: "personal" | "photos" | "documents" | "music" | "videos" | "safe";
  filePath?: string;
  virtualId?: string;
  mountId?: string;
}

export interface FavoriteEntry {
  id: string;
  path: string;
  label: string;
  kind: "file" | "directory" | "virtual";
  createdAt: string;
}

export interface RecentSearch {
  id: string;
  text: string;
  scope: string;
  createdAt: string;
}

export interface FileItem {
  name: string;
  path: string;
  kind: FileKind;
  size: number;
  modifiedAt: string;
  createdAt?: string;
  accessedAt?: string;
  extension: string;
  icon?: string;
  favorite?: boolean;
}

export interface FileDetails extends FileItem {
  description?: string;
  tags: string[];
  absolutePath?: string;
}

export interface RecycleRecord {
  recycleId: string;
  name: string;
  originalPath: string;
  deletedAt: string;
  kind: FileKind;
  size: number;
}

export interface TreeNode {
  id: string;
  label: string;
  section: TreeSection;
  kind: "directory" | "virtual" | "mount";
  path: string;
  icon: string;
  children?: TreeNode[];
  locked?: boolean;
}

export interface AdminStorageConfig {
  personal: string;
  photos: string;
  documents: string;
  music: string;
  videos: string;
  safeBox: string;
  recycle: string;
}

export interface SafeBoxStatus {
  state: SafeBoxState;
  message: string;
  path: string;
  cooldownSeconds?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  level: NotificationLevel;
  targetPath?: string;
}

export interface ActivityRecord {
  id: string;
  action: string;
  path: string;
  message: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface MemoAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
}

export interface MemoEntry {
  id: string;
  path: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  attachments: MemoAttachment[];
}

export interface MemoDraft {
  id: string;
  path: string;
  content: string;
  updatedAt: string;
}

export interface MemoUpload {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
  markdown: string;
  size: number;
}

export interface PathMetadata {
  path: string;
  description: string;
  tags: string[];
}

export interface MountDefinition {
  id: string;
  type: "local" | "ftp" | "webdav";
  name: string;
  root: string;
  enabled: boolean;
  username?: string;
}

export interface ExplorerEvent {
  id: string;
  type: "file" | "metadata" | "notification" | "config" | "plugin";
  message: string;
  path?: string;
  createdAt: string;
}

export interface BootstrapData {
  user: {
    id: "local";
    name: "Local User";
    isAdmin: true;
    permissions: readonly ["*"];
  };
  features: Record<string, boolean>;
  theme: string;
  language: string;
  plugins: readonly PluginManifest[];
  tree?: readonly TreeNode[];
  storage?: AdminStorageConfig;
  notifications?: readonly NotificationItem[];
}

export interface PluginManifest {
  id: string;
  name: string;
  enabled: boolean;
  compatible: boolean;
  reason?: string;
  staticBaseUrl?: string;
  extensions: string[];
  category: "viewer" | "editor" | "media" | "thumbnail" | "unsupported";
}
