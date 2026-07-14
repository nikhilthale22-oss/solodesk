import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { resolve } from "../lib/resolver";
import { ViewConfig } from "../lib/types";
import TaskRow from "./TaskRow";
import { Plus } from "./Icons";

function withSearch(config: ViewConfig, search: string): ViewConfig {
  if (!search.trim()) return config;
  return { ...config, filters: [...config.filters, { field: "search", op: "contains", value: search }] };
}

export default function ListView() {
  const tasks = useStore((s) => s.tasks);
  const config = useStore((s) => s.config);
  const search = useStore((s) => s.search);
  const statuses = useStore((s) => (s.scope.kind === "list" ? (s.statusByList[s.scope.listId] ?? []) : []));
  const addTask = useStore.getState().addTask;

  const groups = useMemo(
    () => resolve({ tasks, statuses, config: withSearch(config, search) }),
    [tasks, statuses, config, search]
  );
  const showStatus = config.groupBy !== "status";

  const [addKey, setAddKey] = useState<string | null>(null);
  const [val, setVal] = useState("");
  const submit = (statusId?: string) => {
    if (val.trim()) addTask(val, { statusId: statusId ?? null });
    setVal("");
  };

  const empty = groups.every((g) => g.tasks.length === 0);

  return (
    <div className="listview">
      {groups.map((g) => (
        <section key={g.key} className="lgroup">
          <div className="lgroup-head">
            <span className="lgroup-dot" style={{ background: g.color }} />
            <span className="lgroup-label">{g.label}</span>
            <span className="lgroup-count">{g.tasks.length}</span>
          </div>
          <div className="lgroup-body">
            {g.tasks.map((t) => (
              <TaskRow key={t.id} task={t} showStatus={showStatus} />
            ))}

            {g.statusId &&
              (addKey === g.key ? (
                <div className="ladd">
                  <input
                    autoFocus
                    value={val}
                    placeholder="Task name…  (Enter to add · Esc to close)"
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={() => setAddKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit(g.statusId);
                      if (e.key === "Escape") {
                        setAddKey(null);
                        setVal("");
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  className="ladd-btn"
                  onClick={() => {
                    setAddKey(g.key);
                    setVal("");
                  }}
                >
                  <Plus size={14} /> Add task
                </button>
              ))}
          </div>
        </section>
      ))}

      {empty && (
        <div className="empty">
          <p>Nothing here yet.</p>
          <p className="empty-sub">
            Add a task above, or press <kbd>⌘⇧K</kbd> to quick-capture.
          </p>
        </div>
      )}
    </div>
  );
}
