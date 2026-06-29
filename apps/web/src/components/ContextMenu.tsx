import { Copy, Download, Edit3, FileArchive, FolderInput, Info, Trash2 } from "lucide-react";

const actions = [
  ["打开", Edit3],
  ["预览", Info],
  ["下载", Download],
  ["重命名", Edit3],
  ["复制", Copy],
  ["移动", FolderInput],
  ["删除", Trash2],
  ["压缩/解压", FileArchive],
  ["属性", Info]
] as const;

export function ContextMenu() {
  return (
    <div className="context-menu" aria-label="文件操作菜单">
      {actions.map(([label, Icon]) => (
        <button key={label} type="button"><Icon size={15} />{label}</button>
      ))}
    </div>
  );
}
