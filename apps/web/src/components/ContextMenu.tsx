import { Copy, Download, Edit3, FileArchive, FolderInput, Info, Trash2 } from "lucide-react";
import { text } from "../i18n";

const actions = [
  [text.contextMenu.actions.open, Edit3],
  [text.contextMenu.actions.preview, Info],
  [text.contextMenu.actions.download, Download],
  [text.contextMenu.actions.rename, Edit3],
  [text.contextMenu.actions.copy, Copy],
  [text.contextMenu.actions.move, FolderInput],
  [text.contextMenu.actions.delete, Trash2],
  [text.contextMenu.actions.archive, FileArchive],
  [text.contextMenu.actions.properties, Info]
] as const;

export function ContextMenu() {
  return (
    <div className="context-menu" aria-label={text.contextMenu.label}>
      {actions.map(([label, Icon]) => (
        <button key={label} type="button"><Icon size={15} />{label}</button>
      ))}
    </div>
  );
}
