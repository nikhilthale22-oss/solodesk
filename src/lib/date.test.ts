import { describe, expect, it } from "vitest";
import { parseCapture, startOfDay, startOfWeek, addDays, DAY_MS, atMinutes, minutesOfDay, formatDue } from "./date";

describe("parseCapture", () => {
  it("extracts a trailing date word and an inline priority", () => {
    const r = parseCapture("Ship the deck tomorrow !1");
    expect(r.name).toBe("Ship the deck");
    expect(r.priority).toBe(1);
    expect(r.due).toBe(startOfDay(Date.now()) + DAY_MS);
  });

  it("understands 'today'", () => {
    const r = parseCapture("Buy milk today");
    expect(r.name).toBe("Buy milk");
    expect(r.due).toBe(startOfDay(Date.now()));
  });

  it("resolves a weekday to a future Friday", () => {
    const r = parseCapture("Call vendor fri");
    expect(r.name).toBe("Call vendor");
    expect(r.due).not.toBeNull();
    expect(new Date(r.due!).getDay()).toBe(5);
    expect(r.due!).toBeGreaterThan(startOfDay(Date.now()));
  });

  it("does not treat a lone date word as a date", () => {
    const r = parseCapture("today");
    expect(r.name).toBe("today");
    expect(r.due).toBeNull();
  });

  it("leaves a plain task unchanged", () => {
    expect(parseCapture("Just a task")).toEqual({ name: "Just a task", due: null, priority: 0 });
  });
});

describe("date helpers", () => {
  it("startOfWeek returns the Monday on/before a date", () => {
    const wed = new Date(2026, 6, 15, 13).getTime();
    const sow = startOfWeek(wed);
    expect(new Date(sow).getDay()).toBe(1); // Monday
    expect(sow).toBeLessThanOrEqual(startOfDay(wed));
    expect(startOfDay(wed) - sow).toBeLessThan(7 * DAY_MS);
  });

  it("addDays crosses month boundaries", () => {
    const jan1 = startOfDay(new Date(2026, 0, 1).getTime());
    expect(addDays(jan1, 31)).toBe(startOfDay(new Date(2026, 1, 1).getTime()));
  });

  it("atMinutes / minutesOfDay round-trip", () => {
    const day = startOfDay(Date.now());
    expect(minutesOfDay(atMinutes(day, 9 * 60 + 30))).toBe(9 * 60 + 30);
  });

  it("formatDue uses relative labels", () => {
    const today = startOfDay(Date.now());
    expect(formatDue(today)).toBe("Today");
    expect(formatDue(today + DAY_MS)).toBe("Tomorrow");
    expect(formatDue(today - DAY_MS)).toBe("Yesterday");
    expect(formatDue(null)).toBe("");
  });
});
