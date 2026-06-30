import { Bell, Languages, Menu, Palette, Plug, Settings } from "lucide-react";
import { useState } from "react";
import { uiAssets } from "../assets";
import { text } from "../i18n";

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
      <button title={text.bottomMenu.notificationTitle} aria-label={text.bottomMenu.notifications} type="button" className="icon-button notification-button">
        <Bell size={18} />
      </button>
      <button title={text.bottomMenu.openMenuTitle} aria-label={text.bottomMenu.menu} type="button" className="icon-button" onClick={() => setOpen((value) => !value)}>
        <Menu size={18} />
      </button>
      {open && (
        <div className="bottom-popover" role="menu">
          <div className="popover-status"><img src={uiAssets.success} alt="" />Webbox</div>
          <button type="button" onClick={onAdmin}><Settings size={16} />{text.bottomMenu.admin}</button>
          <button type="button" onClick={onPlugins}><Plug size={16} />{text.bottomMenu.plugins}</button>
          <button type="button" onClick={() => setLanguageOpen((value) => !value)}><Languages size={16} />{text.bottomMenu.languages}</button>
          {languageOpen && <div className="sub-actions"><button type="button">{text.bottomMenu.simplifiedChinese}</button><button type="button">{text.bottomMenu.english}</button></div>}
          <button type="button" onClick={() => setThemeOpen((value) => !value)}><Palette size={16} />{text.bottomMenu.theme}</button>
          {themeOpen && <div className="sub-actions"><button type="button">{text.bottomMenu.themeSystem}</button><button type="button">{text.bottomMenu.themeLight}</button><button type="button">{text.bottomMenu.themeDark}</button></div>}
        </div>
      )}
    </div>
  );
}
