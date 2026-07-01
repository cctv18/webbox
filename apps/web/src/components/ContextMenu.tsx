import { Copy, Download, Edit3, FileArchive, FilePlus, FolderInput, FolderPlus, Info, RefreshCw, RotateCcw, Star, Trash2 } from "lucide-react";
import { text } from "../i18n";

export type ContextAction = "open" | "download" | "rename" | "copy" | "move" | "recycle" | "restore" | "deleteForever" | "archive" | "favorite" | "properties" | "refresh" | "newFolder" | "newFile";

const iconMap = {
  open: Edit3,
  download: Download,
  rename: Edit3,
  copy: Copy,
  move: FolderInput,
  recycle: Trash2,
  restore: RotateCcw,
  deleteForever: Trash2,
  archive: FileArchive,
  favorite: Star,
  properties: Info,
  refresh: RefreshCw,
  newFolder: FolderPlus,
  newFile: FilePlus
};

const labelMap: Record<ContextAction, string> = {
  open: text.contextMenu.actions.open,
  download: text.contextMenu.actions.download,
  rename: text.contextMenu.actions.rename,
  copy: text.contextMenu.actions.copy,
  move: text.contextMenu.actions.move,
  recycle: text.contextMenu.actions.recycle,
  restore: text.contextMenu.actions.restore,
  deleteForever: text.contextMenu.actions.deleteForever,
  archive: text.contextMenu.actions.archive,
  favorite: text.contextMenu.actions.favorite,
  properties: text.contextMenu.actions.properties,
  refresh: text.fileManager.refresh,
  newFolder: text.fileManager.newFolder,
  newFile: text.fileManager.newFile
};

interface ContextMenuProps {
  x?: number;
  y?: number;
  actions?: ContextAction[];
  onAction?: (action: ContextAction) => void;
}

export function ContextMenu({ x = 0, y = 0, actions = ["open", "download", "rename", "copy", "move", "recycle", "archive", "favorite", "properties"], onAction }: ContextMenuProps) {
  const width = 190;
  const estimatedHeight = actions.length * 32 + 10;
  const left = Math.max(4, Math.min(x, globalThis.innerWidth ? globalThis.innerWidth - width - 4 : x));
  const top = Math.max(4, Math.min(y, globalThis.innerHeight ? globalThis.innerHeight - estimatedHeight - 4 : y));
  return (
    <div className="context-menu" aria-label={text.contextMenu.label} style={{ left, top }}>
      {actions.map((action) => {
        const Icon = iconMap[action];
        return (
          <button key={action} type="button" onClick={() => onAction?.(action)}><Icon size={15} />{labelMap[action]}</button>
        );
      })}
      {/*
        Removed by design: 编辑锁定, 快速外链分享, 创建快捷方式, 发送到桌面快捷方式.
      */}
    </div>
  );
}
