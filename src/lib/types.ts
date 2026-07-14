// Core domain types. Mirrors src-tauri/migrations/001_init.sql.

export type ID = string;

export type StatusGroup = "not_started" | "active" | "done" | "closed";

export interface List {
  id: ID;
  name: string;
  color: string;
  is_inbox: number; // 0 | 1
  orderindex: number;
  created_at: number;
  archived_at: number | null;
  deleted_at: number | null;
}

export interface Status {
  id: ID;
  list_id: ID;
  name: string;
  color: string;
  grp: StatusGroup;
  orderindex: number;
}

// 0 none, 1 urgent, 2 high, 3 normal, 4 low  (matches ClickUp's ordering)
export type Priority = 0 | 1 | 2 | 3 | 4;

export interface Task {
  id: ID;
  list_id: ID;
  parent_id: ID | null;
  name: string;
  description: string | null;
  status_id: ID | null;
  priority: Priority;
  due_date: number | null;
  start_date: number | null;
  scheduled_start: number | null; // datetime (ms) of the work block, incl. time-of-day
  duration_min: number | null; // block length in minutes
  orderindex: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  archived_at: number | null;
  deleted_at: number | null;
}

export const PRIORITIES: Record<Priority, { label: string; color: string; short: string }> = {
  0: { label: "No priority", color: "var(--muted)", short: "—" },
  1: { label: "Urgent", color: "#e0524e", short: "P1" },
  2: { label: "High", color: "#d98a12", short: "P2" },
  3: { label: "Normal", color: "#3a86d6", short: "P3" },
  4: { label: "Low", color: "#8b95a7", short: "P4" },
};

export const STATUS_GROUPS: Record<StatusGroup, { label: string; order: number }> = {
  not_started: { label: "To Do", order: 0 },
  active: { label: "In Progress", order: 1 },
  done: { label: "Done", order: 2 },
  closed: { label: "Closed", order: 3 },
};

// ── View system ────────────────────────────────────────────────────────
export type ViewType = "list" | "board";
export type GroupBy = "status" | "priority" | "none";

export interface Filter {
  field: "statusGroup" | "priority" | "search" | "due";
  op: "is" | "in" | "contains" | "before" | "onOrBefore";
  value: unknown;
}

export interface ViewConfig {
  type: ViewType;
  groupBy: GroupBy;
  filters: Filter[];
  sort: { field: keyof Task | "priority"; dir: "asc" | "desc" };
  showCompleted: boolean;
}

export interface Group {
  key: string;
  label: string;
  color: string;
  statusId?: ID; // when grouped by status, the status a dropped/created card should get
  tasks: Task[];
}
