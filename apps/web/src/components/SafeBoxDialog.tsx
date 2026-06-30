import { useState } from "react";
import type { SafeBoxStatus } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";

interface SafeBoxDialogProps {
  status: SafeBoxStatus;
  onClose: () => void;
  onUnlock: (status: SafeBoxStatus) => void;
}

export function SafeBoxDialog({ status, onClose, onUnlock }: SafeBoxDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isSetup = status.state === "notOpen";

  const submit = async () => {
    try {
      const next = isSetup ? await client.safeOpen(password) : await client.safeLogin(password);
      onUnlock(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.safeBox.loginFailed);
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="safe-dialog">
        <header><h2>{isSetup ? text.safeBox.setupTitle : text.safeBox.loginTitle}</h2></header>
        <label>{text.safeBox.password}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="toast">{error}</div>}
        <footer>
          <button type="button" onClick={onClose}>{text.admin.close}</button>
          <button type="button" onClick={submit}>{isSetup ? text.safeBox.open : text.safeBox.unlock}</button>
        </footer>
      </section>
    </div>
  );
}
