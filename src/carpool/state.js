import { useState, useEffect } from "react";
import { LIMIT_RANGE, defaultPersons, normLang, DEFAULT_LIMITS, TAXI_RANGE } from "./planner.js";
import { cleanRules } from "./checks.js";

export const STORE = "carpool-v3";

export function useLang() {
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "de" || q === "en") return q;
    try {
      const s = localStorage.getItem("carpool-lang");
      if (s === "de" || s === "en") return s;
    } catch {}
    return "de";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("carpool-lang", lang);
    } catch {}
  }, [lang]);
  return [lang, setLang];
}

// roster, chosen leg, rest mode and manual seat edits stay in this browser
export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.persons) && s.persons.every((p) => p && p.id && p.name && Array.isArray(p.legs))) return s;
  } catch {}
  return null;
}

// what forces a fresh plan: the leg, how the rest travels, and who drives how many seats.
// Everything else (people joining or leaving, group sizes) is merged into the manually edited layout.
export const structKeyOf = (persons, leg, restBy, groupBy) =>
  `${leg}|${restBy}|${groupBy}|` + persons.filter((p) => p.legs[leg] && p.car).map((p) => `${p.id}:${p.seats}`).join(",");

export const isDriverPos = (pos) => pos.car[0] === "c" && pos.idx === 0;

export const clampLimit = (v, d, range = LIMIT_RANGE) => (Number.isInteger(v) && v >= range[0] && v <= range[1] ? v : d);

// ---------- section order + saved variants (a view preference: kept in localStorage, not part of the plan / undo) ----------
// the hero stays on top and rules / closing tile / footer stay at the bottom; these sections can be moved
export const SECTION_KEYS = ["leg", "plan", "counts", "checks", "cars", "tram", "taxi", "people", "cards"];

export const LAYOUT_STORE = "carpool-layouts-v1";

export const normOrder = (o) => {
  const seen = new Set();
  const list = (Array.isArray(o) ? o : []).filter((k) => SECTION_KEYS.includes(k) && !seen.has(k) && seen.add(k));
  return [...list, ...SECTION_KEYS.filter((k) => !seen.has(k))];
};

export const sameOrder = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

export function loadLayouts() {
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_STORE));
    if (s) {
      const variants = (Array.isArray(s.variants) ? s.variants : [])
        .filter((v) => v && v.id && typeof v.name === "string")
        .map((v) => ({ id: String(v.id), name: v.name, order: normOrder(v.order) }));
      return { variants, activeId: variants.some((v) => v.id === s.activeId) ? s.activeId : null, order: normOrder(s.order) };
    }
  } catch {}
  return { variants: [], activeId: null, order: SECTION_KEYS };
}

// everything that is saved and can be undone lives in one document
// an older saved test list (4 teams) gets the current test teams; lists with own teams are left alone
export function refreshTestTeams(persons) {
  const demo = new Map(defaultPersons().map((p) => [p.id, p]));
  const isDemo = (p) => demo.has(p.id) && demo.get(p.id).name === p.name;
  const old = new Set(["", "SAP PE", "TRBK", "Marketing", "Projektleitung"]);
  const mine = persons.filter(isDemo);
  if (!mine.length || !mine.every((p) => old.has(p.team))) return persons;
  return persons.map((p) => (isDemo(p) ? { ...p, team: demo.get(p.id).team, lang: p.lang || demo.get(p.id).lang } : p));
}

export const initialDoc = (saved) => ({
  persons: refreshTestTeams((saved?.persons || defaultPersons()).map((p) => ({ team: "", note: "", ...p, lang: normLang(p.lang) }))),
  restBy: saved?.restBy === "taxi" ? "taxi" : "tram",
  groupBy: ["team", "lang"].includes(saved?.groupBy) ? saved.groupBy : "none",
  limits: {
    groupMax: clampLimit(saved?.limits?.groupMax, DEFAULT_LIMITS.groupMax),
    taxiSeats: clampLimit(saved?.limits?.taxiSeats, DEFAULT_LIMITS.taxiSeats, TAXI_RANGE),
  },
  edits: saved?.edits || {}, // { [leg]: { key, layout } }
  rules: cleanRules(saved?.rules), // custom checks, saved with the plan
});

export function docReducer(state, a) {
  const keep = 60;
  if (a.type === "undo") {
    if (!state.past.length) return state;
    return { doc: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.doc, ...state.future] };
  }
  if (a.type === "redo") {
    if (!state.future.length) return state;
    return { doc: state.future[0], past: [...state.past, state.doc], future: state.future.slice(1) };
  }
  const next = a.fn(state.doc);
  if (next === state.doc) return state;
  return { doc: next, past: [...state.past.slice(-(keep - 1)), state.doc], future: [] };
}
