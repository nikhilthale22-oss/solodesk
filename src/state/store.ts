import { create } from "zustand";
import { List, Status, Task, ViewConfig, ViewType, GroupBy, Priority } from "../lib/types";
import { parseCapture, startOfDay, startOfWeek, addDays, DAY_MS } from "../lib/date";
import { doneGroup } from "../lib/resolver";
import * as api from "../db/client";

type Theme = "light" | "dark";
type CalMode = "day" | "week";
type Scope = { kind: "list"; listId: string } | { kind: "today" } | { kind: "calendar" };

interface AppState {
  ready: boolean;
  error: string | null;
  lists: List[];
  statusByList: Record<string, Status[]>;
  statusById: Record<string, Status>;
  scope: Scope;
  tasks: Task[];
  config: ViewConfig;
  search: string;
  paletteOpen: boolean;
  captureOpen: boolean;
  theme: Theme;

  // calendar / time-blocking
  calMode: CalMode;
  calAnchor: number; // start-of-day ms of the focused day/week
  calTasks: Task[]; // scheduled blocks in the visible range
  unscheduled: Task[]; // the "to schedule" tray

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  selectList: (id: string) => Promise<void>;
  selectToday: () => Promise<void>;
  selectCalendar: () => Promise<void>;
  setCalMode: (m: CalMode) => void;
  calShift: (dir: number) => Promise<void>;
  calToday: () => Promise<void>;
  dropAt: (taskId: string, start: number) => Promise<void>;
  resizeBlock: (task: Task, durationMin: number) => Promise<void>;
  unschedule: (task: Task) => Promise<void>;
  createScheduled: (name: string, start: number, durationMin: number) => Promise<void>;

  setViewType: (t: ViewType) => void;
  setGroupBy: (g: GroupBy) => void;
  setSearch: (q: string) => void;
  setShowCompleted: (b: boolean) => void;

  activeList: () => List | undefined;
  activeStatuses: () => Status[];
  inboxId: () => string | undefined;

  addTask: (
    name: string,
    opts?: { statusId?: string | null; priority?: Priority; due?: number | null }
  ) => Promise<void>;
  addSubtask: (parent: Task, name: string) => Promise<void>;
  quickCapture: (raw: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  setStatus: (task: Task, statusId: string) => Promise<void>;
  setPriority: (task: Task, p: Priority) => Promise<void>;
  setDue: (task: Task, ts: number | null) => Promise<void>;
  rename: (task: Task, name: string) => Promise<void>;
  remove: (task: Task) => Promise<void>;
  createList: (name: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  openPalette: () => void;
  closePalette: () => void;
  openCapture: () => void;
  closeCapture: () => void;
  setTheme: (t: Theme) => void;
}

const DEFAULT_CONFIG: ViewConfig = {
  type: "list",
  groupBy: "status",
  filters: [],
  sort: { field: "orderindex", dir: "asc" },
  showCompleted: false,
};

function initialTheme(): Theme {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  lists: [],
  statusByList: {},
  statusById: {},
  scope: { kind: "today" },
  tasks: [],
  config: DEFAULT_CONFIG,
  search: "",
  paletteOpen: false,
  captureOpen: false,
  theme: initialTheme(),

  calMode: "day",
  calAnchor: startOfDay(Date.now()),
  calTasks: [],
  unscheduled: [],

  init: async () => {
    try {
      let lists = await api.getLists();
      if (lists.length === 0) {
        await api.seedIfEmpty();
        lists = await api.getLists();
      }
      const first = lists.find((l) => l.is_inbox === 0) ?? lists[0];
      set({ scope: first ? { kind: "list", listId: first.id } : { kind: "today" } });
      await get().refresh();
      set({ ready: true, error: null });
    } catch (e) {
      set({ error: String(e), ready: false });
    }
  },

  refresh: async () => {
    const lists = await api.getLists();
    const statusByList: Record<string, Status[]> = {};
    const statusById: Record<string, Status> = {};
    for (const l of lists) {
      const st = await api.getStatuses(l.id);
      statusByList[l.id] = st;
      for (const s of st) statusById[s.id] = s;
    }
    const scope = get().scope;
    let tasks: Task[] = [];
    let calTasks = get().calTasks;
    let unscheduled = get().unscheduled;
    if (scope.kind === "list") {
      const exists = lists.some((l) => l.id === scope.listId);
      const listId = exists ? scope.listId : (lists[0]?.id ?? "");
      tasks = listId ? await api.getTasksForList(listId) : [];
      if (!exists && lists[0]) set({ scope: { kind: "list", listId: lists[0].id } });
    } else if (scope.kind === "today") {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      tasks = await api.getTasksDueThrough(endOfToday.getTime());
    } else {
      const anchor = get().calAnchor;
      const start = get().calMode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
      const end = start + (get().calMode === "week" ? 7 : 1) * DAY_MS;
      calTasks = await api.getTasksScheduledBetween(start, end);
      unscheduled = await api.getUnscheduledTasks();
    }
    set({ lists, statusByList, statusById, tasks, calTasks, unscheduled });
  },

  selectList: async (id) => {
    set({ scope: { kind: "list", listId: id }, search: "" });
    await get().refresh();
  },
  selectToday: async () => {
    set({ scope: { kind: "today" }, search: "" });
    await get().refresh();
  },
  selectCalendar: async () => {
    set({ scope: { kind: "calendar" }, search: "" });
    await get().refresh();
  },
  setCalMode: (m) => {
    set({ calMode: m });
    if (get().scope.kind === "calendar") get().refresh();
  },
  calShift: async (dir) => {
    const step = get().calMode === "week" ? 7 : 1;
    set({ calAnchor: addDays(get().calAnchor, dir * step) });
    await get().refresh();
  },
  calToday: async () => {
    set({ calAnchor: startOfDay(Date.now()) });
    await get().refresh();
  },
  dropAt: async (taskId, start) => {
    const t = [...get().calTasks, ...get().unscheduled].find((x) => x.id === taskId);
    if (!t) return;
    const patch: Partial<Task> = { scheduled_start: start };
    if (t.duration_min == null) patch.duration_min = 60;
    await api.updateTask(taskId, patch);
    await get().refresh();
  },
  resizeBlock: async (task, durationMin) => {
    await api.updateTask(task.id, { duration_min: Math.max(15, Math.round(durationMin)) });
    await get().refresh();
  },
  unschedule: async (task) => {
    await api.updateTask(task.id, { scheduled_start: null });
    await get().refresh();
  },
  createScheduled: async (name, start, durationMin) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const s = get();
    const listId = s.inboxId() ?? s.lists[0]?.id;
    if (!listId) return;
    const statusId = (s.statusByList[listId] ?? []).find((x) => x.grp === "not_started")?.id ?? null;
    await api.createTask({
      list_id: listId,
      name: trimmed,
      status_id: statusId,
      scheduled_start: start,
      duration_min: durationMin,
    });
    await get().refresh();
  },

  setViewType: (t) => set((s) => ({ config: { ...s.config, type: t } })),
  setGroupBy: (g) => set((s) => ({ config: { ...s.config, groupBy: g } })),
  setSearch: (q) => set({ search: q }),
  setShowCompleted: (b) => set((s) => ({ config: { ...s.config, showCompleted: b } })),

  activeList: () => {
    const s = get();
    if (s.scope.kind !== "list") return undefined;
    const listId = s.scope.listId;
    return s.lists.find((l) => l.id === listId);
  },
  activeStatuses: () => {
    const s = get();
    return s.scope.kind === "list" ? (s.statusByList[s.scope.listId] ?? []) : [];
  },
  inboxId: () => get().lists.find((l) => l.is_inbox === 1)?.id,

  addTask: async (name, opts) => {
    const s = get();
    const trimmed = name.trim();
    if (!trimmed) return;
    let listId: string | undefined;
    let statusId = opts?.statusId ?? null;
    if (s.scope.kind === "list") {
      listId = s.scope.listId;
      if (statusId === null) statusId = (s.statusByList[listId] ?? []).find((x) => x.grp === "not_started")?.id ?? null;
    } else {
      listId = s.inboxId();
    }
    if (!listId) return;
    await api.createTask({
      list_id: listId,
      name: trimmed,
      status_id: statusId,
      priority: opts?.priority ?? 0,
      due_date: opts?.due ?? null,
    });
    await get().refresh();
  },

  addSubtask: async (parent, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const st = get().statusByList[parent.list_id] ?? [];
    const statusId = st.find((x) => x.grp === "not_started")?.id ?? null;
    await api.createTask({ list_id: parent.list_id, name: trimmed, parent_id: parent.id, status_id: statusId });
    await get().refresh();
  },

  quickCapture: async (raw) => {
    const { name, due, priority } = parseCapture(raw);
    if (!name) return;
    const s = get();
    const listId = s.inboxId() ?? (s.scope.kind === "list" ? s.scope.listId : undefined);
    if (!listId) return;
    const statusId = (s.statusByList[listId] ?? []).find((x) => x.grp === "not_started")?.id ?? null;
    await api.createTask({ list_id: listId, name, status_id: statusId, priority, due_date: due });
    await get().refresh();
  },

  toggleComplete: async (task) => {
    const st = get().statusByList[task.list_id] ?? [];
    const cur = task.status_id ? get().statusById[task.status_id] : undefined;
    const isDone = doneGroup(cur?.grp) || task.completed_at != null;
    if (isDone) {
      const back = st.find((x) => x.grp === "not_started") ?? st[0];
      await api.updateTask(task.id, { status_id: back?.id ?? null, completed_at: null });
    } else {
      const done = st.find((x) => x.grp === "done") ?? st.find((x) => x.grp === "closed");
      await api.updateTask(task.id, { status_id: done?.id ?? task.status_id, completed_at: Date.now() });
    }
    await get().refresh();
  },

  setStatus: async (task, statusId) => {
    const grp = get().statusById[statusId]?.grp;
    const completed_at = grp === "done" || grp === "closed" ? Date.now() : null;
    await api.updateTask(task.id, { status_id: statusId, completed_at });
    await get().refresh();
  },
  setPriority: async (task, p) => {
    await api.updateTask(task.id, { priority: p });
    await get().refresh();
  },
  setDue: async (task, ts) => {
    await api.updateTask(task.id, { due_date: ts });
    await get().refresh();
  },
  rename: async (task, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task.name) return;
    await api.updateTask(task.id, { name: trimmed });
    await get().refresh();
  },
  remove: async (task) => {
    await api.deleteTask(task.id);
    await get().refresh();
  },
  createList: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const l = await api.createList(trimmed);
    set({ scope: { kind: "list", listId: l.id } });
    await get().refresh();
  },
  undo: async () => {
    await api.undoLast();
    await get().refresh();
  },
  redo: async () => {
    await api.redoLast();
    await get().refresh();
  },

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  openCapture: () => set({ captureOpen: true }),
  closeCapture: () => set({ captureOpen: false }),
  setTheme: (t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
}));
