import { Bell, Languages, Menu, Palette, Plug, Settings } from "lucide-react";
import { useState } from "react";
import type { NotificationItem } from "@webbox/shared";
import { uiAssets } from "../assets";
import { text } from "../i18n";
import { NotificationPanel } from "./NotificationPanel";

interface BottomMenuProps {
  onAdmin: () => void;
  onPlugins: () => void;
  notifications?: NotificationItem[];
  onNotificationRead?: (id: string) => void;
  onNotificationClear?: () => void;
  onLanguage?: (language: "zh-CN" | "en-US") => void;
  onTheme?: (theme: "light" | "dark" | "system") => void;
}

export function BottomMenu({ onAdmin, onPlugins, notifications = [], onNotificationRead, onNotificationClear, onLanguage, onTheme }: BottomMenuProps) {
  const [open, setOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <div className="bottom-menu">
      <button title={text.bottomMenu.notificationTitle} aria-label={text.bottomMenu.notifications} type="button" className="icon-button notification-button" onClick={() => {
        setNoticeOpen((value) => !value);
        setOpen(false);
      }}>
        <Bell size={18} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      <button title={text.bottomMenu.openMenuTitle} aria-label={text.bottomMenu.menu} type="button" className="icon-button" onClick={() => {
        setOpen((value) => !value);
        setNoticeOpen(false);
      }}>
        <Menu size={18} />
      </button>
      {open && (
        <div className="bottom-popover" role="menu">
          <div className="popover-status"><img src={uiAssets.success} alt="" />Webbox</div>
          <button type="button" onClick={onAdmin}><Settings size={16} />{text.bottomMenu.admin}</button>
          <button type="button" onClick={onPlugins}><Plug size={16} />{text.bottomMenu.plugins}</button>
          <button type="button" onClick={() => setLanguageOpen((value) => !value)}><Languages size={16} />{text.bottomMenu.languages}</button>
          {languageOpen && <div className="sub-actions"><button type="button" onClick={() => onLanguage?.("zh-CN")}>{text.bottomMenu.simplifiedChinese}</button><button type="button" onClick={() => onLanguage?.("en-US")}>{text.bottomMenu.english}</button></div>}
          <button type="button" onClick={() => setThemeOpen((value) => !value)}><Palette size={16} />{text.bottomMenu.theme}</button>
          {themeOpen && <div className="sub-actions"><button type="button" onClick={() => onTheme?.("system")}>{text.bottomMenu.themeSystem}</button><button type="button" onClick={() => onTheme?.("light")}>{text.bottomMenu.themeLight}</button><button type="button" onClick={() => onTheme?.("dark")}>{text.bottomMenu.themeDark}</button></div>}
        </div>
      )}
      {noticeOpen && <NotificationPanel items={notifications} onMarkRead={(id) => onNotificationRead?.(id)} onClear={() => onNotificationClear?.()} />}
    </div>
  );
}
