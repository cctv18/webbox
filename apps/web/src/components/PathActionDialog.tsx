import { X } from "lucide-react";
import { useState } from "react";
import type { TreeNode } from "@webbox/shared";
import { NavigationTree } from "./NavigationTree";

interface PathActionDialogProps {
  title: string;
  label: string;
  initialPath: string;
  tree: TreeNode[];
  confirmLabel?: string;
  onConfirm: (path: string) => void;
  onClose: () => void;
}

export function PathActionDialog({ title, label, initialPath, tree, confirmLabel = "确认", onConfirm, onClose }: PathActionDialogProps) {
  const [value, setValue] = useState(initialPath);
  const [expandedIds, setExpandedIds] = useState(["locations", "personal", "tools", "mounts"]);
  return (
    <div className="modal-backdrop">
      <section className="path-dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <label>{label}<input value={value} onChange={(event) => setValue(event.currentTarget.value)} /></label>
        <div className="path-dialog-tree" aria-label="目录选择">
          <NavigationTree
            tree={tree}
            activeId={value}
            expandedIds={expandedIds}
            onExpandedChange={setExpandedIds}
            onSelect={(node) => setValue(node.path)}
          />
        </div>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" onClick={() => onConfirm(value)}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
