import { useEffect, useState } from "react";
import type { BootstrapData } from "@webbox/shared";
import { client } from "./api/client";
import { FileManager } from "./components/FileManager";
import "./styles.css";

export function AppShell({ bootstrap }: { bootstrap: BootstrapData }) {
  return (
    <main className="app-shell">
      <FileManager bootstrap={bootstrap} />
    </main>
  );
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/api/plugins/kodbox-shim.js";
    script.async = true;
    document.head.appendChild(script);
    client.bootstrap().then(setBootstrap).catch((err: Error) => setError(err.message));
    return () => {
      script.remove();
    };
  }, []);

  if (error) return <div className="status">加载失败：{error}</div>;
  if (!bootstrap) return <div className="status">加载中</div>;
  return <AppShell bootstrap={bootstrap} />;
}
