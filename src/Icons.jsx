import React from "react";

// Simple 24x24 line icons (stroke only, inherit colour)
const PATHS = {
  coffee: "M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z M16 10h2a2 2 0 0 1 0 4h-2 M7 3v3 M10 3v3 M13 3v3",
  mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6",
  food: "M7 3v7 M5 3v5a2 2 0 0 0 4 0V3 M7 10v11 M17 3c-2.2 1.6-3 4.2-3 7h3v11",
  bus: "M5 5h14a1 1 0 0 1 1 1v10H4V6a1 1 0 0 1 1-1z M4 12h16 M7 16v4 M17 16v4",
  pin: "M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z M12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  chip: "M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4",
  chart: "M5 20V11 M11 20V4 M17 20v-7 M3 20h18",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4 M12 7.5v1.5 M12 17v1.5",
  chat: "M4 5h16v11H9l-5 4V5z",
  gauge: "M4 17a8 8 0 1 1 16 0 M12 17l4-5 M5 21h14",
  hand: "M8 12V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 14",
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.star} />
    </svg>
  );
}
