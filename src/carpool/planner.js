// Roster + transfer planner. Everything runs in the browser, nothing is sent anywhere.
// Test names are fictional until HR loads the real list (CSV).
import { EVENT, AGENDA } from "../agenda.js";

export const CAR_SEATS = 5; // driver included
export const MIN_SEATS = 2; // e.g. a cabrio
export const GROUP_TICKET_MAX = 5; // RMV group day ticket: up to 5 people
export const TAXI_SEATS = 4;
export const MIN_TICKET_GROUP = 3; // a rest of 1-2 people takes a taxi instead of a group ticket

// the two transfers of the day, taken from the live agenda
const police = AGENDA.find((a) => a.title.en.includes("Guided Lost Places"));
const dinner = AGENDA.find((a) => a.title.en.startsWith("Dinner"));
const T1 = AGENDA.find((a) => a.title.en.startsWith("Start of the Christmas"));
const T2 = AGENDA.find((a) => a.title.en.startsWith("Transfer to Casa"));
export const LEGS = [
  {
    time: T1.from,
    from: { name: { de: "JW Marriott", en: "JW Marriott" }, addr: EVENT.address },
    to: { name: { de: "Altes Polizeipräsidium", en: "Old Police Headquarters" }, addr: police.location },
  },
  {
    time: T2.from,
    from: { name: { de: "Altes Polizeipräsidium", en: "Old Police Headquarters" }, addr: police.location },
    to: { name: { de: "Casa Isoletta", en: "Casa Isoletta" }, addr: dinner.location },
  },
];

const FIRST = ["Alex", "Bea", "Chris", "Dana", "Eli", "Finn", "Gina", "Hugo"];
const LAST = ["Beispiel", "Muster", "Probe", "Demo", "Testmann"];
const NAMES = LAST.flatMap((l) => FIRST.map((f) => `${f} ${l}`)); // 40 fictional names

export function newPerson(name, extra = {}) {
  return { id: `P${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, car: false, seats: CAR_SEATS, legs: [true, true], team: "", lang: "", note: "", ...extra };
}

// next free fictional name
export function nextName(persons) {
  const used = new Set(persons.map((p) => p.name));
  return NAMES.find((n) => !used.has(n)) || `Person ${persons.length + 1}`;
}

// 40 test persons, 4 of them bring a car (alternating positions so the cars are spread over the list)
const TEAMS = ["SAP PE", "TRBK", "Marketing", "Projektleitung", "Finance"];
// the three languages of the team
export const LANG_OPTIONS = ["DE", "EN", "RU"];
const LANG_WORDS = { de: "DE", deutsch: "DE", german: "DE", en: "EN", englisch: "EN", english: "EN", ru: "RU", russisch: "RU", russian: "RU", русский: "RU" };
export const normLang = (v) => LANG_WORDS[String(v || "").trim().toLowerCase()] || "";
const LANGS = ["DE", "DE", "EN", "RU", "DE", "EN", "DE", "RU", "DE", "DE"];
export function defaultPersons() {
  return NAMES.map((name, i) => ({
    id: `P${String(i + 1).padStart(2, "0")}`,
    name,
    car: i % 10 === 0,
    seats: CAR_SEATS,
    legs: [true, true],
    team: TEAMS[(i * 3 + Math.floor(i / 5)) % TEAMS.length],
    lang: LANGS[(i * 7 + 3) % LANGS.length],
    note: i === 4 ? "Rollstuhl" : i === 11 ? "Gepäck" : "",
  }));
}

// what "belongs together" when grouping: the team or the spoken language
export const tagOf = (p, by) => (by === "team" ? p.team : by === "lang" ? p.lang : "") || "";

// plan one transfer: drivers take passengers (balanced), the rest goes by tram groups or by taxi
export const DEFAULT_LIMITS = { groupMax: GROUP_TICKET_MAX, taxiSeats: TAXI_SEATS };
export const LIMIT_RANGE = [2, 8]; // people per group ticket
export const TAXI_RANGE = [2, 4]; // a taxi takes 4 at most

export function planLeg(persons, leg, restBy = "tram", limits = DEFAULT_LIMITS, groupBy = "none") {
  const { groupMax, taxiSeats } = limits;
  const minGroup = Math.min(MIN_TICKET_GROUP, groupMax);
  const active = persons.filter((p) => p.legs[leg]);
  const drivers = active.filter((p) => p.car);
  let riders = active.filter((p) => !p.car);
  // people with the same team / language sit next to each other, so cars and groups fill with them first
  if (groupBy !== "none") {
    riders = riders
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const x = tagOf(a.p, groupBy) || "￿";
        const y = tagOf(b.p, groupBy) || "￿";
        return x < y ? -1 : x > y ? 1 : a.i - b.i;
      })
      .map((o) => o.p);
  }

  const cars = drivers.map((d, i) => ({ id: i + 1, driver: d, seats: d.seats, passengers: [] }));
  const rest = [];
  for (const p of riders) {
    const open = cars.filter((c) => c.passengers.length + 1 < c.seats);
    if (!open.length) {
      rest.push(p);
      continue;
    }
    // even loads; with grouping the car whose driver / passengers share the tag wins
    const tag = tagOf(p, groupBy);
    const score = (c) =>
      groupBy === "none" || !tag ? 0 : (tagOf(c.driver, groupBy) === tag ? 3 : 0) + c.passengers.filter((q) => tagOf(q, groupBy) === tag).length;
    const best = open.reduce((m, c) => {
      const d = score(c) - score(m);
      return d > 0 || (d === 0 && c.passengers.length < m.passengers.length) ? c : m;
    });
    best.passengers.push(p);
  }

  let tram = [];
  let taxiList = [];
  if (restBy === "tram") {
    for (let i = 0; i < rest.length; i += groupMax) tram.push(rest.slice(i, i + groupMax));
    if (tram.length && tram[tram.length - 1].length < minGroup) taxiList = tram.pop();
  } else {
    taxiList = rest;
  }
  const tramGroups = tram.map((members, i) => ({ id: i + 1, buyer: members[0], members }));
  const taxis = [];
  for (let i = 0; i < taxiList.length; i += taxiSeats) taxis.push({ id: taxis.length + 1, members: taxiList.slice(i, i + taxiSeats) });

  return {
    cars,
    tramGroups,
    taxis,
    away: persons.length - active.length,
    count: {
      car: cars.reduce((n, c) => n + 1 + c.passengers.length, 0),
      tram: tramGroups.reduce((n, g) => n + g.members.length, 0),
      taxi: taxis.reduce((n, t) => n + t.members.length, 0),
    },
  };
}

// ---------- editable layout of one leg ----------
// boxes: { c1: [driverId, passengerId|null, ...], g1: [id|null x groupMax], t1: [id|null x taxiSeats] }
// order: box ids per kind (labels are numbered by position), buyers: group id -> person who buys the ticket
const pad = (list, n) => {
  const a = list.slice(0, n);
  while (a.length < n) a.push(null);
  return a;
};

export function baseLayout(plan, limits = DEFAULT_LIMITS) {
  const boxes = {};
  const order = { cars: [], groups: [], taxis: [] };
  const buyers = {};
  plan.cars.forEach((c, i) => {
    const id = `c${i + 1}`;
    boxes[id] = pad([c.driver.id, ...c.passengers.map((p) => p.id)], c.seats);
    order.cars.push(id);
  });
  plan.tramGroups.forEach((g, i) => {
    const id = `g${i + 1}`;
    boxes[id] = pad(g.members.map((p) => p.id), limits.groupMax);
    buyers[id] = g.buyer.id;
    order.groups.push(id);
  });
  plan.taxis.forEach((x, i) => {
    const id = `t${i + 1}`;
    boxes[id] = pad(x.members.map((p) => p.id), limits.taxiSeats);
    order.taxis.push(id);
  });
  return { boxes, order, buyers, times: {} };
}

// every non-empty group needs a valid ticket buyer
export function fixBuyers(layout) {
  const buyers = {};
  layout.order.groups.forEach((g) => {
    const members = layout.boxes[g].filter(Boolean);
    if (members.length) buyers[g] = members.includes(layout.buyers[g]) ? layout.buyers[g] : members[0];
  });
  return { ...layout, buyers };
}

export function newBoxId(layout, prefix) {
  const used = Object.keys(layout.boxes)
    .filter((k) => k[0] === prefix)
    .map((k) => +k.slice(1));
  return `${prefix}${Math.max(0, ...used) + 1}`;
}

// set how many people go by car / tram / taxi (sum stays the same). People keep their place where possible:
// the last ones of a mode that shrinks move over to the mode that grows.
export function applyCounts(l, target, limits) {
  const carSlots = [];
  l.order.cars.forEach((id) => l.boxes[id].forEach((_, i) => i > 0 && carSlots.push([id, i])));
  const riders = carSlots.filter(([b, i]) => l.boxes[b][i]);
  const group = l.order.groups.flatMap((g) => l.boxes[g].filter(Boolean));
  const taxi = l.order.taxis.flatMap((g) => l.boxes[g].filter(Boolean));
  const carNow = riders.length + l.order.cars.length;
  const pool = [];
  const carDelta = target.car - carNow;
  for (let k = 0; k < -carDelta; k++) {
    const [b, i] = riders[riders.length - 1 - k];
    pool.push(l.boxes[b][i]);
    l.boxes[b][i] = null;
  }
  if (group.length > target.tram) pool.push(...group.splice(target.tram));
  if (taxi.length > target.taxi) pool.push(...taxi.splice(target.taxi));
  if (carDelta > 0) {
    const open = carSlots.filter(([b, i]) => !l.boxes[b][i]);
    for (let k = 0; k < carDelta && k < open.length && pool.length; k++) l.boxes[open[k][0]][open[k][1]] = pool.shift();
  }
  if (group.length < target.tram) group.push(...pool.splice(0, target.tram - group.length));
  if (taxi.length < target.taxi) taxi.push(...pool.splice(0, target.taxi - taxi.length));

  // refill the groups / taxis in order with their new members; unused boxes disappear
  const refill = (kind, prefix, list, size) => {
    const need = Math.ceil(list.length / size);
    const ids = l.order[kind].slice(0, need);
    l.order[kind].slice(need).forEach((id) => delete l.boxes[id]);
    while (ids.length < need) ids.push(newBoxId({ boxes: { ...l.boxes, ...Object.fromEntries(ids.map((i) => [i, 0])) } }, prefix));
    l.order[kind] = ids;
    ids.forEach((id, n) => (l.boxes[id] = pad(list.slice(n * size, (n + 1) * size), size)));
  };
  refill("groups", "g", group, limits.groupMax);
  refill("taxis", "t", taxi, limits.taxiSeats);
  return l;
}

// the layout of another leg as a start for leg `to`: same cars, groups and taxis; people who are not on `to` drop out
// (the app fills their places again), drivers who are only on `to` get an empty car, departure times start again
export function copyLayoutToLeg(src, persons, to) {
  const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
  const boxes = {};
  const order = { cars: [], groups: [...src.order.groups], taxis: [...src.order.taxis] };
  src.order.cars.forEach((id) => {
    const d = byId[src.boxes[id][0]];
    if (d && d.car && d.legs[to]) {
      boxes[id] = [...src.boxes[id]];
      order.cars.push(id);
    }
  });
  [...order.groups, ...order.taxis].forEach((id) => (boxes[id] = [...src.boxes[id]]));
  const next = { boxes, order, buyers: { ...src.buyers }, times: {} };
  persons
    .filter((p) => p.car && p.legs[to] && !order.cars.some((id) => boxes[id][0] === p.id))
    .forEach((p) => {
      const id = newBoxId(next, "c");
      boxes[id] = pad([p.id], p.seats);
      order.cars.push(id);
    });
  return fixBuyers(next);
}

// bring a stored (manually edited) layout in line with the current roster and limits:
// people who left are removed, new people take the first free place, sizes follow the limits
export function reconcileLayout(layout, riderIds, limits, restBy) {
  const riders = new Set(riderIds);
  const boxes = {};
  const order = { cars: [...layout.order.cars], groups: [...layout.order.groups], taxis: [...layout.order.taxis] };
  const size = (id) => (id[0] === "g" ? limits.groupMax : id[0] === "t" ? limits.taxiSeats : layout.boxes[id].length);
  const kept = new Set();
  Object.entries(layout.boxes).forEach(([id, slots]) => {
    const car = id[0] === "c";
    let list = slots.map((x, i) => {
      if (car && i === 0) return x; // the driver is part of the structure
      if (x && riders.has(x) && !kept.has(x)) {
        kept.add(x);
        return x;
      }
      return null;
    });
    if (!car && list.length > size(id)) list = list.filter(Boolean);
    boxes[id] = car ? list : pad(list, size(id));
  });
  // whoever lost a place by shrinking a group or taxi is placed again below
  const seen = new Set(Object.entries(boxes).flatMap(([id, l]) => l.filter((x, i) => x && !(id[0] === "c" && i === 0))));
  const times = Object.fromEntries(Object.entries(layout.times || {}).filter(([id]) => id in boxes));
  const next = { boxes, order, buyers: { ...layout.buyers }, times };
  const free = (kinds) => {
    for (const k of kinds)
      for (const id of order[k]) {
        const i = boxes[id].findIndex((x, j) => x === null && !(k === "cars" && j === 0));
        if (i !== -1) return [id, i];
      }
    return null;
  };
  const pref = restBy === "taxi" ? ["cars", "taxis", "groups"] : ["cars", "groups", "taxis"];
  riderIds
    .filter((id) => !seen.has(id))
    .forEach((id) => {
      let spot = free(pref);
      if (!spot) {
        const kind = restBy === "taxi" ? "taxis" : "groups";
        const nid = newBoxId(next, kind === "taxis" ? "t" : "g");
        boxes[nid] = pad([], kind === "taxis" ? limits.taxiSeats : limits.groupMax);
        order[kind].push(nid);
        spot = [nid, 0];
      }
      boxes[spot[0]][spot[1]] = id;
    });
  return fixBuyers(next);
}

// ---------- CSV (Excel in Germany saves with ";") ----------
const YES = /^(1|x|j|ja|y|yes|true|wahr|evet|auto|car)$/i;
const NO = /^(0|n|nein|no|false|falsch|hayir|hayır|-)$/i;

function splitCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/)[0] || "";
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// columns: name; car (ja/nein); seats; leg 1 (ja/nein); leg 2 (ja/nein). Only the name is required; header row is optional.
export function parseRoster(text) {
  const rows = splitCsv(text);
  if (rows.length && /name/i.test(rows[0][0] || "")) rows.shift();
  const out = [];
  rows.forEach((r, i) => {
    const name = (r[0] || "").trim();
    if (!name) return;
    const car = YES.test((r[1] || "").trim());
    const seats = Math.min(CAR_SEATS, Math.max(MIN_SEATS, parseInt(r[2], 10) || CAR_SEATS));
    const flag = (v) => !NO.test((v || "").trim());
    out.push({ id: `I${String(i + 1).padStart(3, "0")}`, name, car, seats, legs: [flag(r[3]), flag(r[4])], team: (r[5] || "").trim(), lang: normLang(r[6]), note: (r[7] || "").trim() });
  });
  return out;
}

export function exportCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}
