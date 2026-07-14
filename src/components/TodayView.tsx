import { useState } from "react";
import { useStore } from "../state/store";
import { startOfDay, isOverdue } from "../lib/date";
import TaskRow from "./TaskRow";

export default function TodayView() {
  const tasks = useStore((s) => s.tasks); // already: due<=today, not completed, top-level, cross-list
  const addTask = useStore.getState().addTask;

  const overdue = tasks.filter((t) => t.due_date != null && isOverdue(t.due_date));
  const today = tasks.filter((t) => t.due_date != null && !isOverdue(t.due_date));

  const [val, setVal] = useState("");
  const add = () => {
    if (val.trim()) addTask(val, { due: startOfDay() });
    setVal("");
  };

  return (
    <div className="listview today">
      <div className="today-add">
        <input
          value={val}
          placeholder="Add a task for today…  (Enter to add — lands in Inbox, due today)"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
      </div>

      {overdue.length > 0 && (
        <section className="lgroup">
          <div className="lgroup-head">
            <span className="lgroup-dot" style={{ background: "#e0524e" }} />
            <span className="lgroup-label">Overdue</span>
            <span className="lgroup-count">{overdue.length}</span>
          </div>
          <div className="lgroup-body">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} showStatus showListBadge />
            ))}
          </div>
        </section>
      )}

      <section className="lgroup">
        <div className="lgroup-head">
          <span className="lgroup-dot" style={{ background: "#6b57f2" }} />
          <span className="lgroup-label">Today</span>
          <span className="lgroup-count">{today.length}</span>
        </div>
        <div className="lgroup-body">
          {today.map((t) => (
            <TaskRow key={t.id} task={t} showStatus showListBadge />
          ))}
          {today.length === 0 && overdue.length === 0 && (
            <div className="empty">
              <p>Nothing due today. 🎯</p>
              <p className="empty-sub">Give a task a due date (the 🗓 button on any row) and it shows up here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
