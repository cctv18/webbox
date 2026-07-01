import { FolderTree, X } from "lucide-react";
import { useState } from "react";
import type { TreeNode } from "@webbox/shared";

interface PathActionDialogProps {
  title: string;
  label: string;
  initialPath: string;
  tree: TreeNode[];
  confirmLabel?: string;
  onConfirm: (path: string) => void;
  onClose: () => void;
}

function flattenDirectories(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenDirectories(node.children ?? [])
  ]).filter((node) => node.kind !== "virtual" || node.path === "/位置" || node.path === "/网络挂载" || node.path === "/工具");
}

export function PathActionDialog({ title, label, initialPath, tree, confirmLabel = "确认", onConfirm, onClose }: PathActionDialogProps) {
  const [value, setValue] = useState(initialPath);
  const nodes = flattenDirectories(tree);
  return (
    <div className="modal-backdrop">
      <section className="path-dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <label>{label}<input value={value} onChange={(event) => setValue(event.currentTarget.value)} /></label>
        <div className="path-dialog-tree" aria-label="目录选择">
          {nodes.map((node) => (
            <button key={node.id} type="button" onClick={() => setValue(node.path)}>
              <FolderTree size={14} />
              <span>{node.path}</span>
            </button>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={() => onConfirm(value)}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
