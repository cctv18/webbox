import { File, Folder } from "lucide-react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import type { FileItem, SortKey, ViewMode } from "@webbox/shared";
import { text } from "../i18n";

export interface InlineEditState {
  mode: "create-folder" | "create-template" | "rename";
  path?: string;
  templateType?: "txt" | "md" | "html" | "docx" | "xlsx" | "pptx";
  value: string;
}

interface FileGridProps {
  items: FileItem[];
  selected: string[];
  viewMode: ViewMode;
  iconSize: number;
  inlineEdit: InlineEditState | null;
  onOpen: (item: FileItem) => void;
  onSelect: (item: FileItem, additive: boolean, range: boolean) => void;
  onContextMenu: (event: MouseEvent, item: FileItem) => void;
  onSort: (key: SortKey) => void;
  onInlineChange: (value: string) => void;
  onInlineCommit: () => void;
  onInlineCancel: () => void;
}

function typeLabel(item: FileItem): string {
  if (item.kind === "directory") return "文件夹";
  return item.extension ? `${item.extension.toUpperCase()} 文件` : "文件";
}

interface InlineInputProps {
  value: string;
  onInlineChange: (value: string) => void;
  onInlineCommit: () => void;
  onInlineCancel: () => void;
}

function InlineInput({ value, onInlineChange, onInlineCommit, onInlineCancel }: InlineInputProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onInlineCommit();
    if (event.key === "Escape") onInlineCancel();
  };
  return (
    <input
      className="inline-name-input"
      autoFocus
      value={value}
      onChange={(event) => onInlineChange(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function FileGrid({
  items,
  selected,
  viewMode,
  iconSize,
  inlineEdit,
  onOpen,
  onSelect,
  onContextMenu,
  onSort,
  onInlineChange,
  onInlineCommit,
  onInlineCancel
}: FileGridProps) {
  const createInput = inlineEdit?.mode.startsWith("create") ? (
    <button className="file-row creating" role="row" type="button">
      <span><Folder size={16} /><InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} /></span>
      <span>{inlineEdit.mode === "create-folder" ? "文件夹" : `${inlineEdit.templateType?.toUpperCase()} 文件`}</span>
      <span>{text.fileManager.directorySize}</span>
      <span>-</span>
    </button>
  ) : null;

  if (viewMode === "grid") {
    return (
      <div className="file-grid" role="grid" aria-label={text.fileManager.fileList} style={{ "--webbox-icon-size": `${iconSize}px` } as CSSProperties}>
        {inlineEdit?.mode.startsWith("create") && (
          <button className="file-tile creating" type="button">
            <Folder size={iconSize} />
            <InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} />
          </button>
        )}
        {items.map((item) => {
          const active = selected.includes(item.path);
          const Icon = item.kind === "directory" ? Folder : File;
          const renaming = inlineEdit?.mode === "rename" && inlineEdit.path === item.path;
          return (
            <button
              key={item.path}
              type="button"
              className={`file-tile ${active ? "selected" : ""}`}
              onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey, event.shiftKey)}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(event) => onContextMenu(event, item)}
            >
              <Icon size={iconSize} />
              {renaming ? <InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} /> : <span>{item.name}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="file-list" role="table" aria-label={text.fileManager.fileList}>
      <div className="file-row header" role="row">
        <button type="button" role="columnheader" onClick={() => onSort("name")}>{text.fileManager.name}</button>
        <button type="button" role="columnheader" onClick={() => onSort("type")}>{text.fileManager.type}</button>
        <button type="button" role="columnheader" onClick={() => onSort("size")}>{text.fileManager.size}</button>
        <button type="button" role="columnheader" onClick={() => onSort("modifiedAt")}>{text.fileManager.modifiedTime}</button>
      </div>
      {createInput}
      {items.map((item) => {
        const active = selected.includes(item.path);
        const Icon = item.kind === "directory" ? Folder : File;
        const renaming = inlineEdit?.mode === "rename" && inlineEdit.path === item.path;
        return (
          <button
            className={`file-row ${active ? "selected" : ""}`}
            role="row"
            type="button"
            key={item.path}
            onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey, event.shiftKey)}
            onDoubleClick={() => onOpen(item)}
            onContextMenu={(event) => onContextMenu(event, item)}
          >
            <span className="file-name-cell"><Icon size={16} />{renaming ? <InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} /> : <span>{item.name}</span>}</span>
            <span>{typeLabel(item)}</span>
            <span>{item.kind === "directory" ? text.fileManager.directorySize : item.size}</span>
            <span>{new Date(item.modifiedAt).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
