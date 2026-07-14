import { useEffect, useState } from "react";
import { useStore } from "../state/store";

export default function QuickCapture() {
  const open = useStore((s) => s.captureOpen);
  const { closeCapture, quickCapture } = useStore.getState();
  const [val, setVal] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (open) {
      setVal("");
      setCount(0);
    }
  }, [open]);
  if (!open) return null;

  const submit = () => {
    if (!val.trim()) return;
    quickCapture(val);
    setVal("");
    setCount((c) => c + 1);
  };

  return (
    <div
      className="overlay top"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCapture();
      }}
    >
      <div className="capture">
        <input
          autoFocus
          className="capture-input"
          value={val}
          placeholder="Capture a task…"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              closeCapture();
            }
          }}
        />
        <div className="capture-hint">
          <span>
            Lands in <b>Inbox</b>
          </span>
          <span>
            <kbd>today</kbd> <kbd>tmr</kbd> <kbd>fri</kbd> due · <kbd>!1</kbd>–<kbd>!4</kbd> priority
          </span>
          {count > 0 && <span className="capture-count">added {count} · keep typing</span>}
        </div>
      </div>
    </div>
  );
}
