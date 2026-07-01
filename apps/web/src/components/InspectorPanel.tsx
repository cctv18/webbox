import { CheckCircle2, Image, Link, Pencil, Save, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActivityRecord, FileDetails, FileItem, MemoEntry, PathMetadata } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";
import { formatBytesWithExact } from "../utils/format";

interface InspectorPanelProps {
  path: string;
  space?: string;
  selectedItems?: FileItem[];
}

export function InspectorPanel({ path, space, selectedItems = [] }: InspectorPanelProps) {
  const [tab, setTab] = useState<"properties" | "memos" | "activity">("properties");
  const [details, setDetails] = useState<FileDetails | null>(null);
  const [properties, setProperties] = useState<PathMetadata>({ path, description: "", tags: [] });
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [memoText, setMemoText] = useState("");
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [toast, setToast] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const multiSelected = selectedItems.length > 1;
  const totalSelectedSize = selectedItems.reduce((total, item) => total + (item.kind === "file" ? item.size : 0), 0);

  const normalizeProperties = (value: Partial<PathMetadata> | null | undefined): PathMetadata => ({
    path: value?.path ?? path,
    description: value?.description ?? "",
    tags: Array.isArray(value?.tags) ? value.tags : []
  });

  useEffect(() => {
    if (multiSelected) setDetails(null);
    else client.details(path, space).then(setDetails).catch(() => setDetails(null));
    client.properties(path).then((value) => setProperties(normalizeProperties(value))).catch(() => setProperties({ path, description: "", tags: [] }));
    client.memos(path).then(setMemos).catch(() => setMemos([]));
    client.activity(path).then(setActivity).catch(() => setActivity([]));
  }, [path, multiSelected]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const saveProperties = async () => {
    setProperties(normalizeProperties(await client.saveProperties(properties)));
    setToast("保存成功");
  };

  const addMemo = async () => {
    if (!memoText.trim()) return;
    if (editingMemoId) {
      const memo = await client.updateMemo(editingMemoId, memoText);
      setMemos((items) => items.map((item) => item.id === memo.id ? memo : item));
      setEditingMemoId(null);
    } else {
      const memo = await client.addMemo(path, memoText);
      setMemos((items) => [memo, ...items]);
    }
    setMemoText("");
    setToast("保存成功");
  };

  const editMemo = (memo: MemoEntry) => {
    setEditingMemoId(memo.id);
    setMemoText(memo.content);
  };

  const deleteMemo = async (id: string) => {
    await client.deleteMemo(id);
    setMemos((items) => items.filter((item) => item.id !== id));
    setToast("保存成功");
  };

  const insertText = (value: string) => setMemoText((current) => `${current}${value}`);

  const insertFiles = async (files: FileList | null, image: boolean) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (image) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        insertText(`\n![${file.name}](${dataUrl})\n`);
      } else {
        insertText(`\n[${file.name}](attachment:${encodeURIComponent(file.name)})\n`);
      }
    }
  };

  return (
    <aside className="inspector-panel">
      <header>
        <h2>{text.inspector.title}</h2>
      </header>
      <div className="inspector-body">
        {tab === "properties" && (
          <div className="properties-tab">
            {multiSelected ? (
              <dl>
                <dt>{text.fileManager.selectedCount}</dt><dd>{selectedItems.length}</dd>
                <dt>{text.fileManager.size}</dt><dd>{formatBytesWithExact(totalSelectedSize)}</dd>
              </dl>
            ) : (
              <dl>
                <dt>{text.fileManager.name}</dt><dd>{details?.name ?? path}</dd>
                <dt>{text.fileManager.size}</dt><dd>{details ? formatBytesWithExact(details.size) : "-"}</dd>
                <dt>{text.fileManager.createdTime}</dt><dd>{details?.createdAt ? new Date(details.createdAt).toLocaleString() : "-"}</dd>
                <dt>{text.fileManager.modifiedTime}</dt><dd>{details?.modifiedAt ? new Date(details.modifiedAt).toLocaleString() : "-"}</dd>
                <dt>{text.fileManager.accessedTime}</dt><dd>{details?.accessedAt ? new Date(details.accessedAt).toLocaleString() : "-"}</dd>
              </dl>
            )}
            <label>
              {text.inspector.tags}
              <input value={properties.tags.join(",")} onChange={(event) => setProperties({ ...properties, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
            </label>
            <label>
              {text.inspector.description}
              <textarea value={properties.description} onChange={(event) => setProperties({ ...properties, description: event.target.value })} />
            </label>
            <button type="button" onClick={saveProperties}>{text.inspector.save}</button>
          </div>
        )}
        {tab === "memos" && (
          <div className="memo-tab">
            <div className="memo-editor">
              {previewMarkdown ? (
                <div className="markdown-preview" aria-label="Markdown 预览区" dangerouslySetInnerHTML={{ __html: renderMarkdown(memoText) }} />
              ) : (
                <textarea placeholder={text.inspector.memoPlaceholder} value={memoText} onChange={(event) => setMemoText(event.target.value)} />
              )}
              <div className="memo-editor-bar">
                <div className="memo-tools">
                  <button type="button" aria-label="Markdown 预览" title="Markdown 预览" onClick={() => setPreviewMarkdown((value) => !value)}><Pencil size={16} /></button>
                  <button type="button" aria-label="插入表情" title="插入表情" onClick={() => setEmojiOpen((value) => !value)}><Smile size={16} /></button>
                  <button type="button" aria-label="插入图片" title="插入图片" onClick={() => imageInputRef.current?.click()}><Image size={16} /></button>
                  <button type="button" aria-label="插入附件" title="插入附件" onClick={() => attachmentInputRef.current?.click()}><Link size={16} /></button>
                </div>
                <button type="button" className="memo-submit" onClick={addMemo}>{editingMemoId ? "保存" : "添加"}</button>
              </div>
              {emojiOpen && (
                <div className="emoji-menu">
                  {["😀", "😊", "👍", "⭐", "📌", "✅", "🔥", "🎯"].map((emoji) => (
                    <button key={emoji} type="button" onClick={() => { insertText(emoji); setEmojiOpen(false); }}>{emoji}</button>
                  ))}
                </div>
              )}
              <input ref={imageInputRef} hidden type="file" accept="image/*" multiple onChange={(event) => void insertFiles(event.currentTarget.files, true)} />
              <input ref={attachmentInputRef} hidden type="file" multiple onChange={(event) => void insertFiles(event.currentTarget.files, false)} />
            </div>
            {memos.map((memo, index) => (
              <article key={memo.id} className="memo-entry">
                <header><span>#{index + 1}</span><time>{new Date(memo.createdAt).toLocaleString()}</time></header>
                <div className="memo-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(memo.content) }} />
                <footer>
                  <button type="button" aria-label="编辑备忘录" onClick={() => editMemo(memo)}><Save size={14} />编辑</button>
                  <button type="button" aria-label="删除备忘录" onClick={() => void deleteMemo(memo.id)}><Trash2 size={14} />删除</button>
                </footer>
              </article>
            ))}
          </div>
        )}
        {tab === "activity" && (
          <div className="activity-tab">
            {activity.length ? activity.map((item) => (
              <article key={item.id} className="activity-entry"><strong>{item.message}</strong><span>{item.path}</span><time>{new Date(item.createdAt).toLocaleString()}</time></article>
            )) : <p>{text.inspector.noActivity}</p>}
          </div>
        )}
      </div>
      <footer className="inspector-tabs" role="tablist">
        {toast && <div className="inspector-toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
        <button className={tab === "properties" ? "active" : ""} type="button" role="tab" aria-selected={tab === "properties"} onClick={() => setTab("properties")}>{text.inspector.properties}</button>
        <button className={tab === "memos" ? "active" : ""} type="button" role="tab" aria-selected={tab === "memos"} onClick={() => setTab("memos")}>{text.inspector.memos}</button>
        <button className={tab === "activity" ? "active" : ""} type="button" role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")}>{text.inspector.activity}</button>
      </footer>
    </aside>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function renderMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img src=\"$2\" alt=\"$1\" />")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\">$1</a>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}
