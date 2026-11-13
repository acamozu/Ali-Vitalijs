import { MIN_TICKET_GROUP, tagOf } from "./planner.js";

// custom rules the user adds by hand (saved with the plan):
//   { id, type, level: "warn" | "info", on, ...params }
//   pair     { a, b, mode: "together" | "apart" }       two people
//   lang     { lang }                                    every vehicle needs at least one person with this language
//   teamMax  { team: "*" | name, max }                   at most `max` people of one team per vehicle
//   person   { p, rule: "noTaxi" | "noTram" | "inCar" | "notAlone" }  a restriction for one person
//   note     { keyword, rule }                           the same restriction for everybody whose note contains the keyword
export const RULE_TYPES = ["pair", "lang", "teamMax", "person", "note"];

export function newRule(type) {
  const base = { id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, type, level: "warn", on: true };
  if (type === "pair") return { ...base, a: "", b: "", mode: "together" };
  if (type === "lang") return { ...base, lang: "DE" };
  if (type === "teamMax") return { ...base, team: "*", max: 2 };
  if (type === "note") return { ...base, keyword: "", rule: "noTram" };
  return { ...base, p: "", rule: "noTaxi" };
}

// a rule counts (in the checks and in the button) only when it is switched on and all its fields are filled in
export function ruleReady(r) {
  if (!r.on) return false;
  if (r.type === "pair") return !!r.a && !!r.b && r.a !== r.b;
  if (r.type === "lang") return !!r.lang;
  if (r.type === "teamMax") return !!r.team && r.max >= 1;
  if (r.type === "person") return !!r.p && !!r.rule;
  if (r.type === "note") return !!String(r.keyword || "").trim() && !!r.rule;
  return false;
}

// keeps only rules of a known shape (saved files / old data)
export function cleanRules(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.id && RULE_TYPES.includes(r.type))
    .map((r) => ({ ...newRule(r.type), ...r, level: r.level === "info" ? "info" : "warn", on: r.on !== false, id: String(r.id) }))
    .map((r) => (r.type === "pair" && r.a && r.a === r.b ? { ...r, b: "" } : r));
}

// does the place of a person break this restriction?
const breaks = (rule, w, alone) =>
  rule === "noTaxi" ? w.kind === "taxi" : rule === "noTram" ? w.kind === "group" : rule === "notAlone" ? alone : w.kind !== "car";

// plan checks per leg. Each hint: { level: "warn" | "info", leg, code, args }
export function computeChecks({ persons, layouts, groupBy, limits, rules = [] }) {
  const out = [];
  const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
  const minGroup = Math.min(MIN_TICKET_GROUP, limits.groupMax);
  layouts.forEach(({ layout: l }, leg) => {
    const add = (level, code, args = {}) => out.push({ level, leg, code, args });
    const size = (id) => l.boxes[id].filter(Boolean).length;
    const active = persons.filter((p) => p.legs[leg]).length;
    if (!active) return add("warn", "noPeople");

    const carFree = l.order.cars.reduce((n, id) => n + l.boxes[id].length - size(id), 0);
    const onFoot = l.order.groups.reduce((n, id) => n + size(id), 0) + l.order.taxis.reduce((n, id) => n + size(id), 0);
    l.order.cars.forEach((id, n) => {
      if (size(id) === 1 && onFoot > 0) add("warn", "emptyCar", { n: n + 1 });
    });
    if (carFree > 0 && onFoot > 0) add("info", "freeSeats", { free: carFree, others: onFoot });

    l.order.groups.forEach((id, n) => {
      const s = size(id);
      if (s === 0) add("info", "emptyBox", { kind: "group", n: n + 1 });
      else if (s < minGroup) add("warn", "smallGroup", { n: n + 1, size: s });
    });
    const taxiFree = l.order.taxis.reduce((n, id) => n + l.boxes[id].length - size(id), 0);
    l.order.taxis.forEach((id, n) => {
      const s = size(id);
      if (s === 0) add("info", "emptyBox", { kind: "taxi", n: n + 1 });
      else if (s === 1 && taxiFree - (l.boxes[id].length - 1) >= 1) add("warn", "lonelyTaxi", { n: n + 1 });
    });

    if (groupBy !== "none") {
      // one line per leg: how many cars / groups / taxis are not uniform
      const ids = [...l.order.cars, ...l.order.groups, ...l.order.taxis].filter((id) => size(id) > 0);
      const mixed = ids.filter((id) => new Set(l.boxes[id].filter(Boolean).map((pid) => tagOf(byId[pid], groupBy) || "–")).size > 1).length;
      if (mixed) add("info", "mixed", { count: mixed, total: ids.length, by: groupBy });
    }

    // the car has to be at the start of the second leg
    if (leg === 1) persons.filter((p) => p.car && p.legs[1] && !p.legs[0]).forEach((p) => add("warn", "carNotThere", { name: p.name }));

    // ---------- custom rules ----------
    const where = {}; // person id -> { id: box id, kind: "car" | "group" | "taxi" }
    const kindOf = { c: "car", g: "group", t: "taxi" };
    Object.entries(l.boxes).forEach(([id, slots]) => slots.forEach((pid) => pid && (where[pid] = { id, kind: kindOf[id[0]] })));
    const filled = Object.entries(l.boxes).filter(([, slots]) => slots.some(Boolean));
    rules
      .filter(ruleReady)
      .forEach((r) => {
        const rule = (args) => add(r.level, "rule", { type: r.type, ...args });
        if (r.type === "pair") {
          const wa = where[r.a];
          const wb = where[r.b];
          if (!r.a || !r.b || r.a === r.b || !wa || !wb) return; // incomplete, or one of them is not on this leg
          const same = wa.id === wb.id;
          if (r.mode === "together" ? !same : same) rule({ a: byId[r.a].name, b: byId[r.b].name, mode: r.mode });
        } else if (r.type === "lang") {
          const bad = filled.filter(([, slots]) => !slots.some((pid) => pid && byId[pid].lang === r.lang)).length;
          if (bad) rule({ lang: r.lang, bad, total: filled.length });
        } else if (r.type === "teamMax") {
          const bad = filled.filter(([, slots]) => {
            const count = {};
            slots.forEach((pid) => {
              const t = pid && byId[pid].team;
              if (t && (r.team === "*" || t === r.team)) count[t] = (count[t] || 0) + 1;
            });
            return Object.values(count).some((n) => n > r.max);
          }).length;
          if (bad) rule({ team: r.team, max: r.max, bad });
        } else if (r.type === "person") {
          const w = where[r.p];
          if (!r.p || !w) return;
          const alone = l.boxes[w.id].filter(Boolean).length === 1; // the only person of their car / group / taxi
          if (breaks(r.rule, w, alone)) rule({ name: byId[r.p].name, rule: r.rule, kind: w.kind });
        } else if (r.type === "note") {
          const kw = r.keyword.trim().toLowerCase();
          const hits = [];
          persons.forEach((p) => {
            const w = where[p.id];
            if (!w || !p.legs[leg] || !p.note || !p.note.toLowerCase().includes(kw)) return;
            if (breaks(r.rule, w, l.boxes[w.id].filter(Boolean).length === 1)) hits.push({ name: p.name, kind: w.kind });
          });
          if (hits.length) rule({ keyword: r.keyword.trim(), rule: r.rule, names: hits.map((h) => h.name).join(", "), count: hits.length, kind: hits[0].kind });
        }
      });
  });
  return out;
}
