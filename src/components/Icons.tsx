// Minimal inline stroke icons (no icon-font dependency).
import type { SVGProps } from "react";
type P = { size?: number; className?: string };
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Check = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const Chevron = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const Plus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Flag = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <path d="M4 22V3" />
  </svg>
);
export const Calendar = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
export const Trash = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
export const Search = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const Inbox = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
export const Sun = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const Moon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
  </svg>
);
export const Undo = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
  </svg>
);
export const Redo = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 7v6h-6" />
    <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
  </svg>
);
export const Today = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
