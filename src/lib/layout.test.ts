import { describe, expect, it } from "vitest";
import { layoutDay } from "./layout";
import { Task } from "./types";

// scheduled_start in ms; we use minutes-since-zero for readability.
function block(id: string, startMin: number, dur: number): Task {
  return {
    id,
    list_id: "l",
    parent_id: null,
    name: id,
    description: null,
    status_id: null,
    priority: 0,
    due_date: null,
    start_date: null,
    scheduled_start: startMin * 60000,
    duration_min: dur,
    orderindex: 0,
    created_at: 0,
    updated_at: 0,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
  };
}
const by = (placed: ReturnType<typeof layoutDay>, id: string) => placed.find((p) => p.task.id === id)!;

describe("layoutDay", () => {
  it("returns nothing for an empty day", () => {
    expect(layoutDay([])).toEqual([]);
  });

  it("gives adjacent (non-overlapping) blocks the full width", () => {
    const placed = layoutDay([block("a", 540, 60), block("b", 600, 60)]); // 9-10, 10-11
    expect(by(placed, "a").width).toBe(100);
    expect(by(placed, "b").width).toBe(100);
    expect(by(placed, "a").left).toBe(0);
    expect(by(placed, "b").left).toBe(0);
  });

  it("splits two overlapping blocks into side-by-side halves", () => {
    const placed = layoutDay([block("a", 540, 90), block("b", 600, 60)]); // 9-10:30 overlaps 10-11
    expect(by(placed, "a").width).toBe(50);
    expect(by(placed, "b").width).toBe(50);
    expect(new Set([by(placed, "a").left, by(placed, "b").left])).toEqual(new Set([0, 50]));
  });

  it("packs three mutually overlapping blocks into thirds", () => {
    const placed = layoutDay([block("a", 540, 60), block("b", 540, 60), block("c", 540, 60)]);
    for (const id of ["a", "b", "c"]) expect(by(placed, id).width).toBeCloseTo(100 / 3, 5);
    expect(new Set(placed.map((p) => Math.round(p.left)))).toEqual(new Set([0, 33, 67]));
  });
});
