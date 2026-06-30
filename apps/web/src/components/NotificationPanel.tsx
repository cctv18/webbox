import type { NotificationItem } from "@webbox/shared";
import { text } from "../i18n";

interface NotificationPanelProps {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
  onClear: () => void;
}

export function NotificationPanel({ items, onMarkRead, onClear }: NotificationPanelProps) {
  return (
    <section className="notification-panel">
      <header>
        <h2>{text.notifications.title}</h2>
        <button type="button" onClick={onClear}>{text.notifications.clear}</button>
      </header>
      {items.length ? items.map((item) => (
        <article key={item.id} className={`notification-item ${item.read ? "read" : "unread"}`}>
          <strong>{item.title}</strong>
          <span>{item.message}</span>
          <button type="button" onClick={() => onMarkRead(item.id)}>{text.notifications.markRead}</button>
        </article>
      )) : <p>{text.notifications.empty}</p>}
    </section>
  );
}
