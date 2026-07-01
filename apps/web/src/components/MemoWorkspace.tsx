import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { MemoEntry } from "@webbox/shared";
import { client } from "../api/client";

const DRAFT_ID = "workspace";

interface MemoWorkspaceProps {
  defaultPath: string;
}

export function MemoWorkspace({ defaultPath }: MemoWorkspaceProps) {
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [boundPath, setBoundPath] = useState(defaultPath);
  const [content, setContent] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string; sticky?: boolean } | null>(null);

  const load = async () => {
    setMemos(await client.allMemos());
  };

  useEffect(() => {
    void load();
    void client.memoDraft(DRAFT_ID).then((draft) => {
      if (!draft?.content) return;
      setBoundPath(draft.path);
      setContent(draft.content);
      setToast({ type: "success", message: "已恢复上次的未保存修改", sticky: true });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!content.trim()) return;
    const timer = window.setTimeout(() => {
      void client.saveMemoDraft(DRAFT_ID, boundPath, content).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [boundPath, content]);

  const save = async () => {
    if (!content.trim()) return;
    try {
      if (editingId) await client.updateMemo(editingId, content, boundPath);
      else await client.addMemo(boundPath, content);
      await client.deleteMemoDraft(DRAFT_ID);
      setEditingId(null);
      setContent("");
      setToast({ type: "success", message: "保存成功" });
      await load();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const edit = (memo: MemoEntry) => {
    setEditingId(memo.id);
    setBoundPath(memo.path);
    setContent(memo.content);
  };

  const remove = async (memo: MemoEntry) => {
    await client.deleteMemo(memo.id);
    if (editingId === memo.id) {
      setEditingId(null);
      setContent("");
    }
    await load();
  };

  const discardDraft = async () => {
    await client.deleteMemoDraft(DRAFT_ID);
    setContent("");
    setToast(null);
  };

  return (
    <section className="memo-workspace">
      <main className="memo-workspace-editor">
        {toast && (
          <div className={`panel-toast ${toast.type}`} role="status">
            {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{toast.message}</span>
            {toast.sticky && <button type="button" onClick={() => void discardDraft()}>丢弃上次修改</button>}
          </div>
        )}
        <label className="memo-bind-path">
          绑定路径
          <input value={boundPath} onChange={(event) => setBoundPath(event.currentTarget.value)} />
        </label>
        <textarea className="memo-workspace-textarea" value={content} onChange={(event) => setContent(event.currentTarget.value)} placeholder="输入备忘录内容，支持 Markdown" />
        <footer>
          <button type="button" onClick={() => { setEditingId(null); setContent(""); }}>新建</button>
          <button type="button" onClick={() => void save()}>{editingId ? "保存修改" : "保存备忘录"}</button>
        </footer>
      </main>
      <aside className="memo-workspace-list">
        <h2>全部备忘录</h2>
        {memos.map((memo) => (
          <article key={memo.id} className={editingId === memo.id ? "active" : ""}>
            <button type="button" onClick={() => edit(memo)}>
              <strong>{memo.path}</strong>
              <span>{memo.content.slice(0, 80) || "空备忘录"}</span>
              <time>{new Date(memo.updatedAt).toLocaleString()}</time>
            </button>
            <button type="button" aria-label="删除备忘录" onClick={() => void remove(memo)}><Trash2 size={14} /></button>
          </article>
        ))}
      </aside>
    </section>
  );
}
