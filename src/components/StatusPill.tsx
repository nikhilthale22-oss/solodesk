import { Status } from "../lib/types";

export default function StatusPill({ status }: { status?: Status }) {
  if (!status) return <span className="pill pill-empty">No status</span>;
  return (
    <span className="pill" style={{ ["--pc" as any]: status.color }}>
      <span className="pill-dot" />
      {status.name}
    </span>
  );
}
