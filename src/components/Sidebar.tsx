import { useState } from "react";
import { useStore } from "../state/store";
import { Plus, Inbox as InboxIcon, Today as TodayIcon, Calendar as CalIcon } from "./Icons";

export default function Sidebar() {
  const lists = useStore((s) => s.lists);
  const scope = useStore((s) => s.scope);
  const { selectList, selectToday, selectCalendar, createList } = useStore.getState();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const add = () => {
    if (name.trim()) createList(name);
    setName("");
    setAdding(false);
  };

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <span className="brand-dot" />
        clickup-local
      </div>

      <nav className="side-nav">
        <button className={`side-item ${scope.kind === "today" ? "active" : ""}`} onClick={() => selectToday()}>
          <TodayIcon size={16} />
          <span>Today</span>
        </button>
        <button className={`side-item ${scope.kind === "calendar" ? "active" : ""}`} onClick={() => selectCalendar()}>
          <CalIcon size={16} />
          <span>Calendar</span>
        </button>

        <div className="side-label">Lists</div>

        {lists.map((l) => (
          <button
            key={l.id}
            className={`side-item ${scope.kind === "list" && scope.listId === l.id ? "active" : ""}`}
            onClick={() => selectList(l.id)}
          >
            {l.is_inbox === 1 ? <InboxIcon size={16} /> : <span className="list-dot" style={{ background: l.color }} />}
            <span>{l.name}</span>
          </button>
        ))}

        {adding ? (
          <input
            className="side-add-input"
            autoFocus
            placeholder="List name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() ? add() : setAdding(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
          />
        ) : (
          <button className="side-item side-add" onClick={() => setAdding(true)}>
            <Plus size={15} />
            <span>New list</span>
          </button>
        )}
      </nav>

      <div className="side-foot">
        <kbd>⌘K</kbd> palette · <kbd>⌘⇧K</kbd> capture
      </div>
    </aside>
  );
}
