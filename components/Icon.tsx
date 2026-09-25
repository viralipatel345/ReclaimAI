// Inline SVG stroke icons (24px grid, currentColor).
const PATHS: Record<string, string> = {
  shield: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z",
  "shield-check": "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z M9 12l2 2 4-4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 9v4 M12 17h.01 M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  form: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h3",
  x: "M6 6l12 12 M18 6L6 18",
  download: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  send: "M4 12l16-8-6 16-2.5-6.5L4 12z",
  lock: "M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 017 0v3",
  pen: "M4 20l4-1 11-11-3-3L5 16l-1 4z M14 6l3 3",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  "arrow-left": "M19 12H5 M11 6l-6 6 6 6",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 100-6 3 3 0 000 6z",
  refresh: "M20 11a8 8 0 00-14.3-4.9L4 8 M4 4v4h4 M4 13a8 8 0 0014.3 4.9L20 16 M20 20v-4h-4",
  flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
  plus: "M12 5v14 M5 12h14",
  exit: "M14 4h5v16h-5 M10 8l-4 4 4 4 M6 12h10",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5 M12 8h.01",
  copy: "M8 8h12v12H8z M4 16V4h12",
  share: "M12 3v12 M7 8l5-5 5 5 M5 13v7h14v-7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14z M20 20l-4-4",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  sparkle: "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className = "", strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
