import { useEffect, useRef, useState } from "react";
import { Task, Priority, PRIORITIES } from "../lib/types";
import { childrenOf } from "../lib/resolver";
import { formatDue, isOverdue, startOfDay } from "../lib/date";
import { useStore } from "../state/store";
import { Flag, Calendar, Trash, Chevron, Plus, Check } from "./Icons";

interface Props {
  task: Task;
  showStatus?: boolean;
  showListBadge?: boolean;
  depth?: number;
}

export default function TaskRow({ task, showStatus = false, showListBadge = false, depth = 0 }: Props) {
  const statusById = useStore((s) => s.statusById);
  const statusByList = useStore((s) => s.statusByList);
  const tasks = useStore((s) => s.tasks);
  const list = useStore((s) => s.lists.find((l) => l.id === task.list_id));
  const { toggleComplete, setPriority, setDue, rename, remove, addSubtask, setStatus } = useStore.getState();

  const status = task.status_id ? statusById[task.status_id] : undefined;
  const done = status ? status.grp === "done" || status.grp === "closed" : task.completed_at != null;
  const kids = childrenOf(task.id, tasks);
  const overdue = task.due_date != null && isOverdue(task.due_date) && !done;
  const statusOptions = statusByList[task.list_id] ?? [];

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(task.name);
  const [adding, setAdding] = useState(false);
  const [sub, setSub] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    rename(task, val);
  };
  const cancel = () => {
    setEditing(false);
    setVal(task.name);
  };
  const cyclePriority = () => setPriority(task, (((task.priority as number) + 1) % 5) as Priority);
  const toggleDueToday = () => setDue(task, task.due_date == null ? startOfDay() : null);

  const openKids = kids.filter((k) => {
    const s = k.status_id ? statusById[k.status_id] : undefined;
    return !(s?.grp === "done" || s?.grp === "closed" || k.completed_at != null);
  }).length;

  return (
    <div className={`trow-wrap depth-${Math.min(depth, 3)}`}>
      <div className={`trow ${done ? "is-done" : ""}`}>
        {kids.length > 0 ? (
          <button
            className={`caret ${expanded ? "open" : ""}`}
            onClick={() => setExpanded((e) => !e)}
            aria-label="Toggle subtasks"
          >
            <Chevron size={13} />
          </button>
        ) : (
          <span className="caret-spacer" />
        )}

        <button
          className={`check ${done ? "checked" : ""}`}
          onClick={() => toggleComplete(task)}
          aria-label={done ? "Mark incomplete" : "Complete"}
          style={status ? { ["--pc" as any]: status.color } : undefined}
        >
          {done && <Check size={12} />}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            className="trow-edit"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
          />
        ) : (
          <span
            className="trow-name"
            onDoubleClick={() => {
              setVal(task.name);
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {task.name}
          </span>
        )}

        <div className="trow-meta">
          {showListBadge && list && (
            <span className="list-badge">
              <span className="list-dot" style={{ background: list.color }} />
              {list.name}
            </span>
          )}
          {task.priority !== 0 && (
            <span
              className="prio"
              style={{ color: PRIORITIES[task.priority].color }}
              title={PRIORITIES[task.priority].label}
            >
              <Flag size={13} />
            </span>
          )}
          {task.due_date != null && (
            <span className={`due ${overdue ? "overdue" : ""}`}>{formatDue(task.due_date)}</span>
          )}
          {kids.length > 0 && (
            <span className="subcount">
              {openKids}/{kids.length}
            </span>
          )}
          {showStatus && statusOptions.length > 0 && (
            <select
              className="status-select"
              value={task.status_id ?? ""}
              onChange={(e) => e.target.value && setStatus(task, e.target.value)}
            >
              {!task.status_id && <option value="">No status</option>}
              {statusOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="trow-actions">
          <button className="act" onClick={cyclePriority} title="Cycle priority">
            <Flag size={14} />
          </button>
          <button className="act" onClick={toggleDueToday} title="Toggle due today">
            <Calendar size={14} />
          </button>
          <button className="act" onClick={() => setAdding((a) => !a)} title="Add subtask">
            <Plus size={14} />
          </button>
          <button className="act danger" onClick={() => remove(task)} title="Delete">
            <Trash size={14} />
          </button>
        </div>
      </div>

      {adding && (
        <div className="subadd" style={{ marginLeft: 30 }}>
          <input
            autoFocus
            placeholder="Subtask name…  (Enter to add · Esc to close)"
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && sub.trim()) {
                addSubtask(task, sub);
                setSub("");
              }
              if (e.key === "Escape") {
                setAdding(false);
                setSub("");
              }
            }}
          />
        </div>
      )}

      {expanded && kids.map((k) => <TaskRow key={k.id} task={k} depth={depth + 1} />)}
    </div>
  );
}
