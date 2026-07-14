import { describe, expect, it } from "vitest";
import { resolve, childrenOf, doneGroup } from "./resolver";
import { Status, Task, ViewConfig } from "./types";

function task(p: Partial<Task>): Task {
  return {
    id: "t",
    list_id: "l",
    parent_id: null,
    name: "n",
    description: null,
    status_id: null,
    priority: 0,
    due_date: null,
    start_date: null,
    scheduled_start: null,
    duration_min: null,
    orderindex: 0,
    created_at: 0,
    updated_at: 0,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
    ...p,
  };
}

const statuses: Status[] = [
  { id: "s_todo", list_id: "l", name: "To Do", color: "#000", grp: "not_started", orderindex: 0 },
  { id: "s_doing", list_id: "l", name: "Doing", color: "#000", grp: "active", orderindex: 1 },
  { id: "s_done", list_id: "l", name: "Done", color: "#000", grp: "done", orderindex: 2 },
];

const cfg = (o: Partial<ViewConfig> = {}): ViewConfig => ({
  type: "list",
  groupBy: "none",
  filters: [],
  sort: { field: "orderindex", dir: "asc" },
  showCompleted: false,
  ...o,
});

describe("resolve", () => {
  it("drops subtasks, deleted, and archived rows", () => {
    const rows = [
      task({ id: "a" }),
      task({ id: "b", parent_id: "a" }),
      task({ id: "c", deleted_at: 1 }),
      task({ id: "d", archived_at: 1 }),
    ];
    const groups = resolve({ tasks: rows, statuses, config: cfg({ groupBy: "none" }) });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(["a"]);
  });

  it("hides completed tasks unless showCompleted is set", () => {
    const rows = [task({ id: "a", status_id: "s_todo" }), task({ id: "b", status_id: "s_done" })];
    expect(resolve({ tasks: rows, statuses, config: cfg() })[0].tasks.map((t) => t.id)).toEqual(["a"]);
    expect(
      resolve({ tasks: rows, statuses, config: cfg({ showCompleted: true }) })[0]
        .tasks.map((t) => t.id)
        .sort()
    ).toEqual(["a", "b"]);
  });

  it("groups by status in group order, with a No-status bucket for orphans", () => {
    const rows = [task({ id: "a", status_id: "s_doing" }), task({ id: "o" })];
    const groups = resolve({ tasks: rows, statuses, config: cfg({ groupBy: "status", showCompleted: true }) });
    expect(groups.map((g) => g.label)).toEqual(["No status", "To Do", "Doing", "Done"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["o"]);
  });

  it("sorts by priority with urgent first and none last", () => {
    const rows = [
      task({ id: "none", priority: 0 }),
      task({ id: "low", priority: 4 }),
      task({ id: "urgent", priority: 1 }),
    ];
    const groups = resolve({ tasks: rows, statuses, config: cfg({ sort: { field: "priority", dir: "asc" } }) });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["urgent", "low", "none"]);
  });

  it("groupBy priority hides the empty No-priority bucket", () => {
    const groups = resolve({ tasks: [task({ id: "u", priority: 1 })], statuses, config: cfg({ groupBy: "priority" }) });
    expect(groups.some((g) => g.key === "p0")).toBe(false);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["u"]);
  });
});

describe("childrenOf / doneGroup", () => {
  it("returns live children ordered by orderindex", () => {
    const all = [
      task({ id: "p" }),
      task({ id: "c2", parent_id: "p", orderindex: 2 }),
      task({ id: "c1", parent_id: "p", orderindex: 1 }),
      task({ id: "cd", parent_id: "p", deleted_at: 1 }),
    ];
    expect(childrenOf("p", all).map((t) => t.id)).toEqual(["c1", "c2"]);
  });

  it("doneGroup only counts done/closed", () => {
    expect(doneGroup("done")).toBe(true);
    expect(doneGroup("closed")).toBe(true);
    expect(doneGroup("active")).toBe(false);
    expect(doneGroup(undefined)).toBe(false);
  });
});
