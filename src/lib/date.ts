// Small date helpers + a forgiving natural-language parser for quick-capture.

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isToday(ts: number): boolean {
  return ts >= startOfDay() && ts <= endOfDay();
}

export function isOverdue(ts: number): boolean {
  return ts < startOfDay();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDue(ts: number | null): string {
  if (ts == null) return "";
  const day = startOfDay(ts);
  const today = startOfDay();
  const diff = Math.round((day - today) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const DAY_MS = 86_400_000;
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Monday-based start of week. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Build a datetime from a day's start-of-day + minutes-since-midnight. */
export function atMinutes(dayStart: number, minutes: number): number {
  const d = new Date(dayStart);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutes * 60_000;
}

export function fmtHourLabel(hour: number): string {
  const ap = hour < 12 ? "AM" : "PM";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr} ${ap}`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ap}` : `${hr}${ap}`;
}

export function fmtTimeRange(start: number, durationMin: number): string {
  return `${fmtClock(start)}–${fmtClock(start + durationMin * 60_000)}`;
}

export function fmtDayLabel(ts: number): string {
  const d = new Date(ts);
  return `${WD_SHORT[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtWeekRange(ts: number): string {
  const a = startOfWeek(ts);
  const b = addDays(a, 6);
  const da = new Date(a);
  const db = new Date(b);
  const left = `${MONTHS[da.getMonth()]} ${da.getDate()}`;
  const right = da.getMonth() === db.getMonth() ? `${db.getDate()}` : `${MONTHS[db.getMonth()]} ${db.getDate()}`;
  return `${left} – ${right}`;
}

export function weekdayShort(ts: number): string {
  return WD_SHORT[new Date(ts).getDay()];
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nextWeekday(target: number): number {
  const d = new Date(startOfDay());
  const cur = d.getDay();
  let delta = (target - cur + 7) % 7;
  if (delta === 0) delta = 7; // "fri" said on a Friday means next Friday
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

export interface ParsedCapture {
  name: string;
  due: number | null;
  priority: 0 | 1 | 2 | 3 | 4;
}

/**
 * Parses trailing/inline shortcuts out of a quick-capture string.
 *   "Ship the deck tomorrow !1"  -> { name:"Ship the deck", due:<tomorrow>, priority:1 }
 *   "Call vendor fri"            -> { name:"Call vendor", due:<next fri>, priority:0 }
 * Supported: today | tod | tomorrow | tmr | mon..sun ; !1..!4 for priority.
 */
export function parseCapture(input: string): ParsedCapture {
  let name = input.trim();
  let due: number | null = null;
  let priority: 0 | 1 | 2 | 3 | 4 = 0;

  // priority token   !1 .. !4  (anywhere)
  const pm = name.match(/(?:^|\s)!([1-4])(?=\s|$)/);
  if (pm) {
    priority = Number(pm[1]) as 1 | 2 | 3 | 4;
    name = (name.slice(0, pm.index) + name.slice(pm.index! + pm[0].length)).trim();
  }

  // date token (last word wins)
  const words = name.split(/\s+/);
  const last = (words[words.length - 1] || "").toLowerCase();
  const matchDate = (w: string): number | null => {
    if (w === "today" || w === "tod") return startOfDay();
    if (w === "tomorrow" || w === "tmr" || w === "tom") return startOfDay() + 86_400_000;
    const wd = WEEKDAYS.indexOf(w.slice(0, 3));
    if (wd >= 0) return nextWeekday(wd);
    return null;
  };
  const d = matchDate(last);
  if (d != null && words.length > 1) {
    due = d;
    words.pop();
    name = words.join(" ");
  }

  return { name: name.trim(), due, priority };
}
