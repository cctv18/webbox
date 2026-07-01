import { File, Folder } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import type { FileItem, SortKey, SortState, ViewMode } from "@webbox/shared";
import { text } from "../i18n";
import { formatBytes } from "../utils/format";

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
  sort: SortState;
  inlineEdit: InlineEditState | null;
  onOpen: (item: FileItem) => void;
  onSelect: (item: FileItem, additive: boolean, range: boolean) => void;
  onSelectionChange: (paths: string[]) => void;
  onClearSelection: () => void;
  onContextMenu: (event: MouseEvent, item: FileItem) => void;
  onSort: (key: SortKey) => void;
  onInlineChange: (value: string) => void;
  onInlineCommit: () => void;
  onInlineCancel: () => void;
}

interface DragSelection {
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
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
  sort,
  inlineEdit,
  onOpen,
  onSelect,
  onSelectionChange,
  onClearSelection,
  onContextMenu,
  onSort,
  onInlineChange,
  onInlineCommit,
  onInlineCancel
}: FileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);

  const updateBoxSelection = (next: DragSelection) => {
    const root = containerRef.current;
    if (!root) return;
    const selectionRect = {
      left: Math.min(next.originX, next.currentX),
      right: Math.max(next.originX, next.currentX),
      top: Math.min(next.originY, next.currentY),
      bottom: Math.max(next.originY, next.currentY)
    };
    const selectedPaths = Array.from(root.querySelectorAll<HTMLElement>("[data-file-path]"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right >= selectionRect.left && rect.left <= selectionRect.right && rect.bottom >= selectionRect.top && rect.top <= selectionRect.bottom;
      })
      .map((element) => element.dataset.filePath)
      .filter((value): value is string => Boolean(value));
    onSelectionChange(selectedPaths);
  };

  const startDragSelection = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest("[data-file-entry], .file-row.header, .inline-name-input")) return;
    const next = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, currentX: event.clientX, currentY: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onClearSelection();
    setDragSelection(next);
  };

  const moveDragSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;
    const next = { ...dragSelection, currentX: event.clientX, currentY: event.clientY };
    setDragSelection(next);
    updateBoxSelection(next);
  };

  const stopDragSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragSelection(null);
  };

  const selectionBoxStyle = dragSelection ? {
    left: Math.min(dragSelection.originX, dragSelection.currentX),
    top: Math.min(dragSelection.originY, dragSelection.currentY),
    width: Math.abs(dragSelection.currentX - dragSelection.originX),
    height: Math.abs(dragSelection.currentY - dragSelection.originY)
  } satisfies CSSProperties : undefined;

  const CreateIcon = inlineEdit?.mode === "create-folder" ? Folder : File;
  const createInput = inlineEdit?.mode.startsWith("create") ? (
    <button className="file-row creating" role="row" type="button">
      <span><CreateIcon size={16} /><InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} /></span>
      <span>{inlineEdit.mode === "create-folder" ? "文件夹" : `${inlineEdit.templateType?.toUpperCase()} 文件`}</span>
      <span>{text.fileManager.directorySize}</span>
      <span>-</span>
    </button>
  ) : null;

  if (viewMode === "grid") {
    return (
      <div
        ref={containerRef}
        className="file-grid"
        role="grid"
        aria-label={text.fileManager.fileList}
        style={{ "--webbox-icon-size": `${iconSize}px` } as CSSProperties}
        onPointerDown={startDragSelection}
        onPointerMove={moveDragSelection}
        onPointerUp={stopDragSelection}
        onPointerCancel={stopDragSelection}
      >
        {selectionBoxStyle && <div className="selection-box" style={selectionBoxStyle} />}
        {inlineEdit?.mode.startsWith("create") && (
          <button className="file-tile creating" type="button">
            <CreateIcon size={iconSize} />
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
              data-file-entry
              data-file-path={item.path}
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
    <div
      ref={containerRef}
      className="file-list"
      role="table"
      aria-label={text.fileManager.fileList}
      onPointerDown={startDragSelection}
      onPointerMove={moveDragSelection}
      onPointerUp={stopDragSelection}
      onPointerCancel={stopDragSelection}
    >
      {selectionBoxStyle && <div className="selection-box" style={selectionBoxStyle} />}
      <div className="file-row header" role="row">
        <SortHeader sort={sort} sortKey="name" label={text.fileManager.name} onSort={onSort} />
        <SortHeader sort={sort} sortKey="type" label={text.fileManager.type} onSort={onSort} />
        <SortHeader sort={sort} sortKey="size" label={text.fileManager.size} onSort={onSort} />
        <SortHeader sort={sort} sortKey="modifiedAt" label={text.fileManager.modifiedTime} onSort={onSort} />
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
            data-file-entry
            data-file-path={item.path}
            onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey, event.shiftKey)}
            onDoubleClick={() => onOpen(item)}
            onContextMenu={(event) => onContextMenu(event, item)}
          >
            <span className="file-name-cell"><Icon size={16} />{renaming ? <InlineInput value={inlineEdit.value} onInlineChange={onInlineChange} onInlineCommit={onInlineCommit} onInlineCancel={onInlineCancel} /> : <span>{item.name}</span>}</span>
            <span>{typeLabel(item)}</span>
            <span>{item.kind === "directory" ? text.fileManager.directorySize : formatBytes(item.size)}</span>
            <span>{new Date(item.modifiedAt).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}

function SortHeader({ sort, sortKey, label, onSort }: { sort: SortState; sortKey: SortKey; label: string; onSort: (key: SortKey) => void }) {
  const active = sort.key === sortKey;
  return (
    <button type="button" role="columnheader" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} onClick={() => onSort(sortKey)}>
      {label}{active && <span className={`sort-arrow ${sort.direction}`} aria-hidden="true" />}
    </button>
  );
}
