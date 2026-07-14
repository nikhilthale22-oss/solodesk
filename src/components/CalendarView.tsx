import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../state/store";
import { Task, PRIORITIES } from "../lib/types";
import {
  atMinutes,
  minutesOfDay,
  startOfDay,
  startOfWeek,
  addDays,
  fmtHourLabel,
  fmtTimeRange,
  weekdayShort,
  isToday,
  formatDue,
} from "../lib/date";
import { Check } from "./Icons";
import { layoutDay } from "../lib/layout";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_PX = 48;
const SLOT_MIN = 30;
const PX_PER_MIN = HOUR_PX / 60;
const GRID_H = (END_HOUR - START_HOUR) * HOUR_PX;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DEFAULT_DUR = 60;

export default function CalendarView() {
  const mode = useStore((s) => s.calMode);
  const anchor = useStore((s) => s.calAnchor);
  const calTasks = useStore((s) => s.calTasks);
  const unscheduled = useStore((s) => s.unscheduled);
  const statusById = useStore((s) => s.statusById);
  const { dropAt, resizeBlock, unschedule, toggleComplete, createScheduled } = useStore.getState();

  const days = useMemo(() => {
    if (mode === "week") {
      const ws = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [startOfDay(anchor)];
  }, [mode, anchor]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, minutesOfDay(Date.now()) * PX_PER_MIN - 140);
  }, []);

  const [resizing, setResizing] = useState<{ id: string; dur: number } | null>(null);
  const [draft, setDraft] = useState<{ day: number; min: number } | null>(null);
  const [draftVal, setDraftVal] = useState("");

  const yToMin = (clientY: number, colEl: HTMLElement): number => {
    const rect = colEl.getBoundingClientRect();
    const min = Math.round((clientY - rect.top) / PX_PER_MIN / SLOT_MIN) * SLOT_MIN;
    return Math.max(0, Math.min(min, 24 * 60 - SLOT_MIN));
  };

  const onDrop = (day: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    dropAt(id, atMinutes(day, yToMin(e.clientY, e.currentTarget as HTMLElement)));
  };

  const onColClick = (day: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".cblock")) return;
    setDraft({ day, min: yToMin(e.clientY, e.currentTarget as HTMLElement) });
    setDraftVal("");
  };

  const startResize = (task: Task, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startDur = task.duration_min ?? DEFAULT_DUR;
    const calc = (ev: PointerEvent) =>
      Math.max(SLOT_MIN, startDur + Math.round((ev.clientY - startY) / PX_PER_MIN / SLOT_MIN) * SLOT_MIN);
    const move = (ev: PointerEvent) => setResizing({ id: task.id, dur: calc(ev) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const dur = calc(ev);
      setResizing(null);
      if (dur !== startDur) resizeBlock(task, dur);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="cal">
      <aside className="cal-tray">
        <div className="cal-tray-head">
          Unscheduled <span className="lgroup-count">{unscheduled.length}</span>
        </div>
        <div className="cal-tray-list">
          {unscheduled.map((t) => (
            <div
              key={t.id}
              className="tray-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              {t.priority !== 0 && <span className="tdot" style={{ background: PRIORITIES[t.priority].color }} />}
              <span className="tray-name">{t.name}</span>
              {t.due_date != null && <span className="due">{formatDue(t.due_date)}</span>}
            </div>
          ))}
          {unscheduled.length === 0 && <div className="tray-empty">All caught up — nothing to schedule.</div>}
        </div>
        <div className="cal-tray-foot">Drag onto the grid to block time · click a slot to create.</div>
      </aside>

      <div className="cal-main">
        <div className="cal-head">
          <div className="cal-corner" />
          {days.map((d) => (
            <div key={d} className={`cal-dayhead ${isToday(d) ? "is-today" : ""}`}>
              <span className="dh-wd">{weekdayShort(d)}</span>
              <span className="dh-dm">{new Date(d).getDate()}</span>
            </div>
          ))}
        </div>

        <div className="cal-scroll" ref={scrollRef}>
          <div className="cal-body" style={{ height: GRID_H }}>
            <div className="cal-gutter">
              {HOURS.map((h) => (
                <div key={h} className="hourlabel" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                  {fmtHourLabel(h)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const blocks = calTasks.filter((t) => t.scheduled_start != null && startOfDay(t.scheduled_start) === day);
              const placed = layoutDay(blocks);
              return (
                <div
                  key={day}
                  className="cal-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(day, e)}
                  onClick={(e) => onColClick(day, e)}
                >
                  {isToday(day) && <div className="nowline" style={{ top: minutesOfDay(Date.now()) * PX_PER_MIN }} />}

                  {placed.map((p) => {
                    const t = p.task;
                    const dur = resizing?.id === t.id ? resizing.dur : (t.duration_min ?? DEFAULT_DUR);
                    const top = minutesOfDay(t.scheduled_start!) * PX_PER_MIN;
                    const height = Math.max(dur * PX_PER_MIN, 20);
                    const status = t.status_id ? statusById[t.status_id] : undefined;
                    const done = status ? status.grp === "done" || status.grp === "closed" : t.completed_at != null;
                    const color = status?.color ?? "#6b57f2";
                    return (
                      <div
                        key={t.id}
                        className={`cblock ${done ? "is-done" : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        style={{
                          top,
                          height,
                          left: `calc(${p.left}% + 2px)`,
                          width: `calc(${p.width}% - 4px)`,
                          ["--pc" as any]: color,
                        }}
                      >
                        <button
                          className={`check ${done ? "checked" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComplete(t);
                          }}
                          style={{ ["--pc" as any]: color }}
                        >
                          {done && <Check size={10} />}
                        </button>
                        <div className="cb-body">
                          <div className="cb-name">{t.name}</div>
                          {height > 34 && <div className="cb-time">{fmtTimeRange(t.scheduled_start!, dur)}</div>}
                        </div>
                        <button
                          className="cb-x"
                          title="Unschedule"
                          onClick={(e) => {
                            e.stopPropagation();
                            unschedule(t);
                          }}
                        >
                          ×
                        </button>
                        <div className="cb-resize" onPointerDown={(e) => startResize(t, e)} title="Drag to resize" />
                      </div>
                    );
                  })}

                  {draft && draft.day === day && (
                    <div
                      className="cblock draft"
                      style={{ top: draft.min * PX_PER_MIN, height: DEFAULT_DUR * PX_PER_MIN, left: 2, right: 2 }}
                    >
                      <input
                        autoFocus
                        value={draftVal}
                        placeholder="New block…  (Enter)"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftVal(e.target.value)}
                        onBlur={() => setDraft(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && draftVal.trim()) {
                            createScheduled(draftVal, atMinutes(draft.day, draft.min), DEFAULT_DUR);
                            setDraft(null);
                          }
                          if (e.key === "Escape") setDraft(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
