import { useEffect, useState } from "react";
import type { ActivityRecord, FileDetails, MemoEntry, PathMetadata } from "@webbox/shared";
import { client } from "../api/client";
import { text } from "../i18n";

interface InspectorPanelProps {
  path: string;
  space?: string;
}

export function InspectorPanel({ path, space }: InspectorPanelProps) {
  const [tab, setTab] = useState<"properties" | "memos" | "activity">("properties");
  const [details, setDetails] = useState<FileDetails | null>(null);
  const [properties, setProperties] = useState<PathMetadata>({ path, description: "", tags: [] });
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [memoText, setMemoText] = useState("");

  const normalizeProperties = (value: Partial<PathMetadata> | null | undefined): PathMetadata => ({
    path: value?.path ?? path,
    description: value?.description ?? "",
    tags: Array.isArray(value?.tags) ? value.tags : []
  });

  useEffect(() => {
    client.details(path, space).then(setDetails).catch(() => setDetails(null));
    client.properties(path).then((value) => setProperties(normalizeProperties(value))).catch(() => setProperties({ path, description: "", tags: [] }));
    client.memos(path).then(setMemos).catch(() => setMemos([]));
    client.activity(path).then(setActivity).catch(() => setActivity([]));
  }, [path]);

  const saveProperties = async () => {
    setProperties(normalizeProperties(await client.saveProperties(properties)));
  };

  const addMemo = async () => {
    if (!memoText.trim()) return;
    const memo = await client.addMemo(path, memoText);
    setMemos((items) => [memo, ...items]);
    setMemoText("");
  };

  return (
    <aside className="inspector-panel">
      <header>
        <h2>{text.inspector.title}</h2>
      </header>
      <div className="inspector-body">
        {tab === "properties" && (
          <div className="properties-tab">
            <dl>
              <dt>{text.fileManager.name}</dt><dd>{details?.name ?? path}</dd>
              <dt>{text.fileManager.size}</dt><dd>{details?.size ?? "-"}</dd>
              <dt>{text.fileManager.createdTime}</dt><dd>{details?.createdAt ? new Date(details.createdAt).toLocaleString() : "-"}</dd>
              <dt>{text.fileManager.modifiedTime}</dt><dd>{details?.modifiedAt ? new Date(details.modifiedAt).toLocaleString() : "-"}</dd>
              <dt>{text.fileManager.accessedTime}</dt><dd>{details?.accessedAt ? new Date(details.accessedAt).toLocaleString() : "-"}</dd>
            </dl>
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
            <div className="memo-tools">
              <button type="button">Markdown</button>
              <button type="button">表情</button>
              <button type="button">图片</button>
              <button type="button">附件</button>
            </div>
            <textarea placeholder={text.inspector.memoPlaceholder} value={memoText} onChange={(event) => setMemoText(event.target.value)} />
            <button type="button" onClick={addMemo}>{text.inspector.addMemo}</button>
            {memos.map((memo) => <article key={memo.id} className="memo-entry">{memo.content}</article>)}
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
        <button className={tab === "properties" ? "active" : ""} type="button" role="tab" aria-selected={tab === "properties"} onClick={() => setTab("properties")}>{text.inspector.properties}</button>
        <button className={tab === "memos" ? "active" : ""} type="button" role="tab" aria-selected={tab === "memos"} onClick={() => setTab("memos")}>{text.inspector.memos}</button>
        <button className={tab === "activity" ? "active" : ""} type="button" role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")}>{text.inspector.activity}</button>
      </footer>
    </aside>
  );
}
