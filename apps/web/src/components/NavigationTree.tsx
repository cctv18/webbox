import { Archive, ChevronRight, Clock, Folder, HardDrive, Heart, Image, Lock, Music, Recycle, Video } from "lucide-react";
import type { TreeNode } from "@webbox/shared";

const iconMap = {
  treeFav: Heart,
  search: Clock,
  safe: Lock,
  recycle: Recycle,
  computer: HardDrive,
  folder: Folder,
  image: Image,
  music: Music,
  video: Video,
  setting: Archive
};

interface NavigationTreeProps {
  tree: TreeNode[];
  activeId: string;
  expandedIds: string[];
  onSelect: (node: TreeNode) => void;
  onExpandedChange: (ids: string[]) => void;
}

export function NavigationTree({ tree, activeId, expandedIds, onSelect, onExpandedChange }: NavigationTreeProps) {
  const expanded = new Set(expandedIds);

  const toggle = (node: TreeNode) => {
    const next = new Set(expandedIds);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    onExpandedChange(Array.from(next));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const Icon = iconMap[node.icon as keyof typeof iconMap] ?? Folder;
    const hasChildren = Boolean(node.children?.length);
    const isCollapsed = hasChildren && !expanded.has(node.id);
    return (
      <div key={node.id} role="none">
        <div
          role="treeitem"
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          aria-selected={activeId === node.id}
          className={`tree-item ${activeId === node.id ? "active" : ""}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            type="button"
            className="tree-expander"
            aria-label={isCollapsed ? `展开${node.label}` : `折叠${node.label}`}
            onClick={() => hasChildren && toggle(node)}
            disabled={!hasChildren}
          >
            {hasChildren && <ChevronRight size={14} className={isCollapsed ? "" : "expanded"} />}
          </button>
          <button type="button" className="tree-label" onClick={() => onSelect(node)}>
            <Icon size={16} />
            <span>{node.label}</span>
          </button>
        </div>
        {hasChildren && !isCollapsed && (
          <div role="group">
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="navigation-tree" aria-label="目录树">
      <div role="tree">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </nav>
  );
}
