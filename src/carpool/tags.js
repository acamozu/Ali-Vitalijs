// colours for teams / languages
const PALETTE = ["#6E92F2", "#F0846F", "#4FBF86", "#E3B13B", "#A67BEF", "#42BFD0", "#EE7DB8", "#8C99A8"];
export const NO_TAG = "#C9CDD3";

// stable colour per value: by position in the sorted list of values in use
export function tagColors(persons, by) {
  const values = [...new Set(persons.map((p) => (by === "team" ? p.team : by === "lang" ? p.lang : "")).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const map = Object.fromEntries(values.map((v, i) => [v, PALETTE[i % PALETTE.length]]));
  return { values, color: (v) => (v && map[v]) || NO_TAG };
}
