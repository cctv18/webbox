import { Bell, Languages, Menu, Palette, Plug, Settings } from "lucide-react";
import { useState } from "react";

interface BottomMenuProps {
  onAdmin: () => void;
  onPlugins: () => void;
}

export function BottomMenu({ onAdmin, onPlugins }: BottomMenuProps) {
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <div className="bottom-menu">
      <button title="站内消息通知" aria-label="通知" type="button" className="icon-button">
        <Bell size={18} />
      </button>
      <button title="打开菜单" aria-label="菜单" type="button" className="icon-button" onClick={() => setOpen((value) => !value)}>
        <Menu size={18} />
      </button>
      {open && (
        <div className="bottom-popover" role="menu">
          <button type="button" onClick={onAdmin}><Settings size={16} />后台管理</button>
          <button type="button" onClick={onPlugins}><Plug size={16} />插件管理</button>
          <button type="button" onClick={() => setLanguageOpen((value) => !value)}><Languages size={16} />多语言</button>
          {languageOpen && <div className="sub-actions"><button type="button">简体中文</button><button type="button">English</button></div>}
          <button type="button" onClick={() => setThemeOpen((value) => !value)}><Palette size={16} />主题样式</button>
          {themeOpen && <div className="sub-actions"><button type="button">跟随系统</button><button type="button">浅色</button><button type="button">深色</button></div>}
        </div>
      )}
    </div>
  );
}
