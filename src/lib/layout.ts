// Pure calendar layout math, split out of CalendarView so it can be unit-tested
// without React. Given a day's scheduled blocks, pack overlapping ones into
// side-by-side columns (an interval-graph greedy-lane assignment).

import { Task } from "./types";

export interface Placed {
  task: Task;
  left: number; // percent offset from the column's left edge
  width: number; // percent of the column width
}

const DEFAULT_DUR = 60;

const endOf = (t: Task): number => t.scheduled_start! + (t.duration_min ?? DEFAULT_DUR) * 60000;

/** Interval-graph column packing so overlapping blocks sit side-by-side. */
export function layoutDay(blocks: Task[]): Placed[] {
  const sorted = [...blocks].sort(
    (a, b) =>
      a.scheduled_start! - b.scheduled_start! || (b.duration_min ?? DEFAULT_DUR) - (a.duration_min ?? DEFAULT_DUR)
  );
  const placed: Placed[] = [];
  let cluster: Task[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes: number[] = [];
    const colOf = new Map<string, number>();
    for (const t of cluster) {
      const s = t.scheduled_start!;
      const e = endOf(t);
      let lane = lanes.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(e);
      } else {
        lanes[lane] = e;
      }
      colOf.set(t.id, lane);
    }
    const cols = Math.max(1, lanes.length);
    for (const t of cluster) {
      const c = colOf.get(t.id)!;
      placed.push({ task: t, left: (c / cols) * 100, width: (1 / cols) * 100 });
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const t of sorted) {
    const s = t.scheduled_start!;
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, endOf(t));
  }
  if (cluster.length) flush();
  return placed;
}
