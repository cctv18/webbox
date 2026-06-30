import { Archive, Clock, Folder, HardDrive, Heart, Image, Lock, Music, Recycle, Video } from "lucide-react";
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
  onSelect: (node: TreeNode) => void;
}

export function NavigationTree({ tree, activeId, onSelect }: NavigationTreeProps) {
  return (
    <nav className="navigation-tree">
      {tree.map((section) => (
        <section key={section.id} className="tree-section">
          <h2>{section.label}</h2>
          {(section.children ?? []).map((node) => {
            const Icon = iconMap[node.icon as keyof typeof iconMap] ?? Folder;
            return (
              <button
                key={node.id}
                type="button"
                className={`tree-item ${activeId === node.id ? "active" : ""}`}
                onClick={() => onSelect(node)}
              >
                <Icon size={16} />
                <span>{node.label}</span>
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
