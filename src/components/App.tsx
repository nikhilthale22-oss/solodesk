import { useEffect } from "react";
import { useStore } from "../state/store";
import Sidebar from "./Sidebar";
import ListView from "./ListView";
import BoardView from "./BoardView";
import TodayView from "./TodayView";
import CalendarView from "./CalendarView";
import QuickCapture from "./QuickCapture";
import CommandPalette from "./CommandPalette";
import { Search, Undo, Redo, Sun, Moon } from "./Icons";
import { fmtDayLabel, fmtWeekRange } from "../lib/date";

// Guards against React 18 StrictMode double-invoking init() (which could
// otherwise seed the demo data twice). Module scope survives the remount.
let booted = false;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div className="boot error">
      <h2>Couldn’t open the database</h2>
      <p>
        This app reaches SQLite through the Tauri shell, so it has to run inside the desktop window — not a plain
        browser tab.
      </p>
      <p>Start it with:</p>
      <pre>npm install{"\n"}npm run tauri dev</pre>
      <p className="err-detail">{error}</p>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const theme = useStore((s) => s.theme);
  const scope = useStore((s) => s.scope);
  const config = useStore((s) => s.config);
  const search = useStore((s) => s.search);
  const calMode = useStore((s) => s.calMode);
  const calAnchor = useStore((s) => s.calAnchor);
  const activeList = useStore((s) => {
    if (s.scope.kind !== "list") return undefined;
    const listId = s.scope.listId;
    return s.lists.find((l) => l.id === listId);
  });

  useEffect(() => {
    if (booted) return;
    booted = true;
    useStore.getState().init();
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.code === "KeyK" && !e.shiftKey) {
        e.preventDefault();
        const s = useStore.getState();
        if (s.paletteOpen) s.closePalette();
        else s.openPalette();
      } else if (meta && e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        useStore.getState().openCapture();
      } else if (meta && e.code === "KeyZ" && !e.shiftKey && !isEditable(document.activeElement)) {
        e.preventDefault();
        useStore.getState().undo();
      } else if (
        meta &&
        !isEditable(document.activeElement) &&
        (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey))
      ) {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Forward-compat: OS-global hotkey. Only fires if the Rust global-shortcut
  // plugin is enabled (see src-tauri/src/lib.rs). Harmless no-op otherwise.
  useEffect(() => {
    let un: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("quick-capture", () => useStore.getState().openCapture()).then((f) => {
          un = f;
        })
      )
      .catch(() => {});
    return () => {
      if (un) un();
    };
  }, []);

  if (error) return <ErrorScreen error={error} />;
  if (!ready) return <div className="boot">Loading your workspace…</div>;

  const s = useStore.getState();
  const title =
    scope.kind === "today" ? "Today" : scope.kind === "calendar" ? "Calendar" : (activeList?.name ?? "Tasks");

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{title}</h1>
          <div className="top-spacer" />

          {scope.kind === "calendar" ? (
            <>
              <div className="seg">
                <button className={calMode === "day" ? "on" : ""} onClick={() => s.setCalMode("day")}>
                  Day
                </button>
                <button className={calMode === "week" ? "on" : ""} onClick={() => s.setCalMode("week")}>
                  Week
                </button>
              </div>
              <div className="cal-nav">
                <button className="icon-btn" onClick={() => s.calShift(-1)} title="Previous" aria-label="Previous">
                  ‹
                </button>
                <button className="tb-today" onClick={() => s.calToday()}>
                  Today
                </button>
                <button className="icon-btn" onClick={() => s.calShift(1)} title="Next" aria-label="Next">
                  ›
                </button>
              </div>
              <span className="cal-range">{calMode === "week" ? fmtWeekRange(calAnchor) : fmtDayLabel(calAnchor)}</span>
            </>
          ) : (
            <>
              {scope.kind === "list" && (
                <div className="seg">
                  <button className={config.type === "list" ? "on" : ""} onClick={() => s.setViewType("list")}>
                    List
                  </button>
                  <button className={config.type === "board" ? "on" : ""} onClick={() => s.setViewType("board")}>
                    Board
                  </button>
                </div>
              )}

              {scope.kind === "list" && (
                <select
                  className="group-select"
                  value={config.groupBy}
                  onChange={(e) => s.setGroupBy(e.target.value as any)}
                >
                  <option value="status">Group: Status</option>
                  <option value="priority">Group: Priority</option>
                  <option value="none">Group: None</option>
                </select>
              )}

              <label className="show-done">
                <input
                  type="checkbox"
                  checked={config.showCompleted}
                  onChange={(e) => s.setShowCompleted(e.target.checked)}
                />
                Done
              </label>

              <div className="search">
                <Search size={14} />
                <input value={search} placeholder="Search…" onChange={(e) => s.setSearch(e.target.value)} />
              </div>
            </>
          )}

          <button className="icon-btn" title="Undo (⌘Z)" onClick={() => s.undo()}>
            <Undo size={16} />
          </button>
          <button className="icon-btn" title="Redo (⌘⇧Z / ⌘Y)" onClick={() => s.redo()}>
            <Redo size={16} />
          </button>
          <button
            className="icon-btn"
            title="Toggle theme"
            onClick={() => s.setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <div className="content">
          {scope.kind === "calendar" ? (
            <CalendarView />
          ) : scope.kind === "today" ? (
            <TodayView />
          ) : config.type === "board" ? (
            <BoardView />
          ) : (
            <ListView />
          )}
        </div>
      </main>

      <QuickCapture />
      <CommandPalette />
    </div>
  );
}
