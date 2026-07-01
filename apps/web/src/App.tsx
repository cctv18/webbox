import { useEffect, useState } from "react";
import type { BootstrapData } from "@webbox/shared";
import { client } from "./api/client";
import { FileManager } from "./components/FileManager";
import { uiAssets } from "./assets";
import { applyTheme, setLanguage, text } from "./i18n";
import "./styles.css";

export function AppShell({ bootstrap }: { bootstrap: BootstrapData }) {
  setLanguage(bootstrap.language === "en-US" ? "en-US" : "zh-CN");
  applyTheme(bootstrap.theme === "dark" || bootstrap.theme === "light" ? bootstrap.theme : "system");
  return (
    <main className="app-shell" onContextMenu={(event) => event.preventDefault()}>
      <FileManager bootstrap={bootstrap} />
    </main>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/api/plugins/webbox-shim.js";
    script.async = true;
    document.head.appendChild(script);
    client.bootstrap().then(setBootstrap).catch((err: Error) => setError(err.message));
    return () => {
      script.remove();
    };
  }, []);

  if (error) {
    return (
      <div className="status status-card">
        <img src={uiAssets.error} alt="" />
        <span>{text.app.loadFailed}：{error}</span>
      </div>
    );
  }
  if (!bootstrap) {
    return (
      <div className="status status-card">
        <img className="status-loading" src={uiAssets.loading} alt="" />
        <span>{text.app.loading}</span>
      </div>
    );
  }
  return <AppShell bootstrap={bootstrap} />;
}
