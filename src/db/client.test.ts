import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, type TestDb } from "./testing";
import * as api from "./client";

let ctx: TestDb;

beforeEach(() => {
  ctx = makeTestDb();
  api.setDriver(ctx.driver);
});

const liveTaskIds = (): string[] =>
  (ctx.raw.prepare("SELECT id FROM task WHERE deleted_at IS NULL").all() as Array<{ id: string }>).map((r) => r.id);
const taskRow = (id: string) =>
  ctx.raw.prepare("SELECT * FROM task WHERE id=?").get(id) as Record<string, unknown> | undefined;
const count = (sql: string): number => (ctx.raw.prepare(sql).get() as { n: number }).n;

describe("undo does not destroy subtasks (regression: cascade data-loss bug)", () => {
  it("editing a parent then undoing keeps its subtasks", async () => {
    const list = await api.createList("L");
    const parent = await api.createTask({ list_id: list.id, name: "Parent" });
    const child = await api.createTask({ list_id: list.id, name: "Child", parent_id: parent.id });

    await api.updateTask(parent.id, { name: "Parent renamed" });
    await api.undoLast();

    expect(liveTaskIds()).toContain(child.id); // the bug hard-deleted this via ON DELETE CASCADE
    expect(taskRow(parent.id)!.name).toBe("Parent"); // undo restored the prior name
  });

  it("sanity: the harness enforces ON DELETE CASCADE (the footgun the fix avoids)", async () => {
    const list = await api.createList("L");
    const parent = await api.createTask({ list_id: list.id, name: "P" });
    const child = await api.createTask({ list_id: list.id, name: "C", parent_id: parent.id });

    // Reproduce the OLD approach directly: INSERT OR REPLACE deletes the parent
    // row first, firing the cascade and destroying the child.
    const row = taskRow(parent.id)!;
    const cols = Object.keys(row);
    const ph = cols.map(() => "?").join(",");
    ctx.raw.prepare(`INSERT OR REPLACE INTO task (${cols.join(",")}) VALUES (${ph})`).run(...cols.map((c) => row[c]));

    expect(taskRow(child.id)).toBeUndefined(); // proves the cascade fires -> validates the test above
  });
});

describe("subtree delete + undo/redo", () => {
  it("soft-deletes the whole subtree and restores all of it on undo", async () => {
    const list = await api.createList("L");
    const parent = await api.createTask({ list_id: list.id, name: "P" });
    const child = await api.createTask({ list_id: list.id, name: "C", parent_id: parent.id });
    const grand = await api.createTask({ list_id: list.id, name: "G", parent_id: child.id });

    await api.deleteTask(parent.id);
    expect(liveTaskIds()).toHaveLength(0); // parent + child + grandchild all gone

    await api.undoLast();
    expect(liveTaskIds().sort()).toEqual([parent.id, child.id, grand.id].sort());

    await api.redoLast();
    expect(liveTaskIds()).toHaveLength(0); // redo re-deletes the whole subtree
  });
});

describe("create undo/redo", () => {
  it("undo removes a new task; redo brings it back", async () => {
    const list = await api.createList("L");
    const t = await api.createTask({ list_id: list.id, name: "X" });

    await api.undoLast();
    expect(liveTaskIds()).not.toContain(t.id);

    await api.redoLast();
    expect(liveTaskIds()).toContain(t.id);
  });
});

describe("update undo/redo restores exact field values", () => {
  it("round-trips priority and due_date", async () => {
    const list = await api.createList("L");
    const t = await api.createTask({ list_id: list.id, name: "Z", priority: 1 });

    await api.updateTask(t.id, { priority: 4, due_date: 123456 });
    await api.undoLast();
    expect(taskRow(t.id)!.priority).toBe(1);
    expect(taskRow(t.id)!.due_date).toBe(null);

    await api.redoLast();
    expect(taskRow(t.id)!.priority).toBe(4);
    expect(taskRow(t.id)!.due_date).toBe(123456);
  });
});

describe("op_log is append-only", () => {
  it("undo marks a row undone instead of deleting it", async () => {
    const list = await api.createList("L");
    await api.createTask({ list_id: list.id, name: "Y" });
    const before = count("SELECT COUNT(*) n FROM op_log");

    await api.undoLast();

    expect(count("SELECT COUNT(*) n FROM op_log")).toBe(before); // nothing deleted
    expect(count("SELECT COUNT(*) n FROM op_log WHERE undone=1")).toBeGreaterThan(0);
  });
});

describe("list create is undoable", () => {
  it("undo hides a just-created list; redo restores it", async () => {
    const l = await api.createList("Temp");
    const ids = async () => (await api.getLists()).map((x) => x.id);

    expect(await ids()).toContain(l.id);
    await api.undoLast();
    expect(await ids()).not.toContain(l.id);
    await api.redoLast();
    expect(await ids()).toContain(l.id);
  });
});
