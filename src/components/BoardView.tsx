import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { resolve } from "../lib/resolver";
import { Group, Task, ViewConfig, Priority, PRIORITIES } from "../lib/types";
import { formatDue, isOverdue } from "../lib/date";
import { Plus, Check, Flag } from "./Icons";

function effectiveConfig(config: ViewConfig, search: string): ViewConfig {
  const groupBy = config.groupBy === "none" ? "status" : config.groupBy; // a board needs columns
  const filters = search.trim()
    ? [...config.filters, { field: "search" as const, op: "contains" as const, value: search }]
    : config.filters;
  return { ...config, groupBy, filters };
}

function BoardCard({ task }: { task: Task }) {
  const statusById = useStore((s) => s.statusById);
  const { toggleComplete } = useStore.getState();
  const status = task.status_id ? statusById[task.status_id] : undefined;
  const done = status ? status.grp === "done" || status.grp === "closed" : task.completed_at != null;
  const overdue = task.due_date != null && isOverdue(task.due_date) && !done;
  return (
    <div
      className={`card ${done ? "is-done" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <button
        className={`check ${done ? "checked" : ""}`}
        onClick={() => toggleComplete(task)}
        aria-label="Complete"
        style={status ? { ["--pc" as any]: status.color } : undefined}
      >
        {done && <Check size={11} />}
      </button>
      <span className="card-name">{task.name}</span>
      <div className="card-meta">
        {task.priority !== 0 && (
          <span
            className="prio"
            style={{ color: PRIORITIES[task.priority].color }}
            title={PRIORITIES[task.priority].label}
          >
            <Flag size={12} />
          </span>
        )}
        {task.due_date != null && <span className={`due ${overdue ? "overdue" : ""}`}>{formatDue(task.due_date)}</span>}
      </div>
    </div>
  );
}

export default function BoardView() {
  const tasks = useStore((s) => s.tasks);
  const config = useStore((s) => s.config);
  const search = useStore((s) => s.search);
  const statuses = useStore((s) => (s.scope.kind === "list" ? (s.statusByList[s.scope.listId] ?? []) : []));
  const { setStatus, setPriority, addTask } = useStore.getState();

  const cfg = effectiveConfig(config, search);
  const groups = useMemo(() => resolve({ tasks, statuses, config: cfg }), [tasks, statuses, cfg]);

  const [addKey, setAddKey] = useState<string | null>(null);
  const [val, setVal] = useState("");

  const dropOnto = (g: Group, taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (g.statusId) setStatus(t, g.statusId);
    else if (g.key.startsWith("p")) setPriority(t, Number(g.key.slice(1)) as Priority);
  };

  const addTo = (g: Group) => {
    if (!val.trim()) {
      setVal("");
      return;
    }
    if (g.statusId) addTask(val, { statusId: g.statusId });
    else if (g.key.startsWith("p")) addTask(val, { priority: Number(g.key.slice(1)) as Priority });
    setVal("");
  };

  return (
    <div className="board">
      {groups.map((g) => (
        <div
          key={g.key}
          className="bcol"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dropOnto(g, e.dataTransfer.getData("text/plain"));
          }}
        >
          <div className="bcol-head">
            <span className="lgroup-dot" style={{ background: g.color }} />
            <span className="bcol-label">{g.label}</span>
            <span className="lgroup-count">{g.tasks.length}</span>
          </div>
          <div className="bcol-body">
            {g.tasks.map((t) => (
              <BoardCard key={t.id} task={t} />
            ))}
            {addKey === g.key ? (
              <textarea
                className="card-add"
                autoFocus
                value={val}
                placeholder="New card…  (Enter to add)"
                onChange={(e) => setVal(e.target.value)}
                onBlur={() => setAddKey(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTo(g);
                  }
                  if (e.key === "Escape") {
                    setAddKey(null);
                    setVal("");
                  }
                }}
              />
            ) : (
              <button
                className="bcol-add"
                onClick={() => {
                  setAddKey(g.key);
                  setVal("");
                }}
              >
                <Plus size={13} /> Add card
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
