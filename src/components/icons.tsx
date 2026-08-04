// Ícones de linha (SVG inline, currentColor) — substituem os emojis.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const IconDashboard = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);
export const IconCampaign = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" />
    <path d="M15 8a4 4 0 0 1 0 8" />
  </svg>
);
export const IconReport = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <rect x="7" y="11" width="3" height="6" />
    <rect x="12" y="7" width="3" height="10" />
    <rect x="17" y="13" width="3" height="4" />
  </svg>
);
export const IconChannels = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <circle cx="12" cy="18" r="2.4" />
    <path d="M8 7.5 10.5 16M16 7.5 13.5 16" />
  </svg>
);
export const IconAutomation = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconSettings = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 6.7 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" />
  </svg>
);
export const IconHelp = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2.5 2-2.5 3.5" />
    <path d="M12 17h.01" />
  </svg>
);
export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 4v5h-5" />
  </svg>
);
export const IconCalendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </svg>
);
export const IconChevron = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
