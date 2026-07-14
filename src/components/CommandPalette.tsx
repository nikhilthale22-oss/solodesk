import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

// substring-first, subsequence-fallback scoring
function score(q: string, text: string): number {
  if (text.includes(q)) return 1000 - text.indexOf(q);
  let ti = 0;
  let hits = 0;
  for (const ch of q) {
    const idx = text.indexOf(ch, ti);
    if (idx < 0) return 0;
    ti = idx + 1;
    hits++;
  }
  return hits;
}

export default function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const lists = useStore((s) => s.lists);
  const theme = useStore((s) => s.theme);
  const st = useStore.getState;

  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<"cmd" | "newlist">("cmd");
  const [listName, setListName] = useState("");

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
      setMode("cmd");
      setListName("");
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const s = st();
    return [
      {
        id: "capture",
        label: "Quick capture a task",
        hint: "⌘⇧K",
        run: () => {
          s.closePalette();
          s.openCapture();
        },
      },
      { id: "newlist", label: "New list…", run: () => setMode("newlist") },
      {
        id: "today",
        label: "Go to Today",
        run: () => {
          s.selectToday();
          s.closePalette();
        },
      },
      ...lists.map((l) => ({
        id: "go-" + l.id,
        label: `Go to ${l.name}`,
        run: () => {
          s.selectList(l.id);
          s.closePalette();
        },
      })),
      {
        id: "view-list",
        label: "View: List",
        run: () => {
          s.setViewType("list");
          s.closePalette();
        },
      },
      {
        id: "view-board",
        label: "View: Board",
        run: () => {
          s.setViewType("board");
          s.closePalette();
        },
      },
      {
        id: "grp-status",
        label: "Group by: Status",
        run: () => {
          s.setGroupBy("status");
          s.closePalette();
        },
      },
      {
        id: "grp-priority",
        label: "Group by: Priority",
        run: () => {
          s.setGroupBy("priority");
          s.closePalette();
        },
      },
      {
        id: "grp-none",
        label: "Group by: None",
        run: () => {
          s.setGroupBy("none");
          s.closePalette();
        },
      },
      {
        id: "toggle-done",
        label: "Toggle completed tasks",
        run: () => {
          const c = st().config;
          st().setShowCompleted(!c.showCompleted);
          s.closePalette();
        },
      },
      {
        id: "undo",
        label: "Undo last change",
        hint: "⌘Z",
        run: () => {
          s.undo();
          s.closePalette();
        },
      },
      {
        id: "theme",
        label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        run: () => {
          s.setTheme(theme === "dark" ? "light" : "dark");
          s.closePalette();
        },
      },
    ];
  }, [lists, theme, st]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return commands;
    return commands
      .map((c) => ({ c, s: score(query, c.label.toLowerCase()) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [q, commands]);

  useEffect(() => {
    if (i >= filtered.length) setI(0);
  }, [filtered.length, i]);

  if (!open) return null;

  if (mode === "newlist") {
    return (
      <div
        className="overlay top"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) st().closePalette();
        }}
      >
        <div className="palette">
          <input
            autoFocus
            className="palette-input"
            value={listName}
            placeholder="New list name…  (Enter to create · Esc back)"
            onChange={(e) => setListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && listName.trim()) {
                st().createList(listName);
                st().closePalette();
              }
              if (e.key === "Escape") setMode("cmd");
            }}
          />
        </div>
      </div>
    );
  }

  const run = (c?: Cmd) => (c ?? filtered[i])?.run();

  return (
    <div
      className="overlay top"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) st().closePalette();
      }}
    >
      <div className="palette">
        <input
          autoFocus
          className="palette-input"
          value={q}
          placeholder="Type a command…"
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setI((v) => Math.min(v + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setI((v) => Math.max(v - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run();
            } else if (e.key === "Escape") {
              e.preventDefault();
              st().closePalette();
            }
          }}
        />
        <div className="palette-list">
          {filtered.map((c, idx) => (
            <button
              key={c.id}
              className={`palette-item ${idx === i ? "active" : ""}`}
              onMouseEnter={() => setI(idx)}
              onClick={() => run(c)}
            >
              <span>{c.label}</span>
              {c.hint && <kbd>{c.hint}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <div className="palette-empty">No commands match “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
