import { File, Folder } from "lucide-react";
import type { MouseEvent } from "react";
import type { FileItem, ViewMode } from "@webbox/shared";
import { text } from "../i18n";

interface FileGridProps {
  items: FileItem[];
  selected: string[];
  viewMode: ViewMode;
  onOpen: (item: FileItem) => void;
  onSelect: (item: FileItem, additive: boolean) => void;
  onContextMenu: (event: MouseEvent, item: FileItem) => void;
}

export function FileGrid({ items, selected, viewMode, onOpen, onSelect, onContextMenu }: FileGridProps) {
  if (viewMode === "grid") {
    return (
      <div className="file-grid" role="grid" aria-label={text.fileManager.fileList}>
        {items.map((item) => {
          const active = selected.includes(item.path);
          const Icon = item.kind === "directory" ? Folder : File;
          return (
            <button
              key={item.path}
              type="button"
              className={`file-tile ${active ? "selected" : ""}`}
              onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey)}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(event) => onContextMenu(event, item)}
            >
              <Icon size={36} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="file-list" role="table" aria-label={text.fileManager.fileList}>
      <div className="file-row header" role="row">
        <span>{text.fileManager.name}</span><span>{text.fileManager.size}</span><span>{text.fileManager.modifiedTime}</span>
      </div>
      {items.map((item) => {
        const active = selected.includes(item.path);
        const Icon = item.kind === "directory" ? Folder : File;
        return (
          <button
            className={`file-row ${active ? "selected" : ""}`}
            role="row"
            type="button"
            key={item.path}
            onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey)}
            onDoubleClick={() => onOpen(item)}
            onContextMenu={(event) => onContextMenu(event, item)}
          >
            <span><Icon size={16} />{item.name}</span>
            <span>{item.kind === "directory" ? text.fileManager.directorySize : item.size}</span>
            <span>{new Date(item.modifiedAt).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
