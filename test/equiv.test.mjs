// Equivalence: the ported SAPUI5 (AMD, ES5) modules must return exactly what the original ES modules return.
// Run: node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { load } from "./amd.mjs";

const SRC = "c:/Users/Mitarbeiter/Desktop/claude_abap/Ali-Vitalijs-event-agenda/src/";
const orig = async (rel) => import(pathToFileURL(SRC + rel).href);

const O = {
  planner: await orig("carpool/planner.js"),
  checks: await orig("carpool/checks.js"),
  share: await orig("carpool/share.js"),
  tags: await orig("carpool/tags.js"),
  state: await orig("carpool/state.js"),
  agenda: await orig("agenda.js"),
};
const P = { planner: load("planner"), checks: load("checks"), share: load("share"), tags: load("tags"), state: load("state") };

const clone = (x) => JSON.parse(JSON.stringify(x));
// deep equality plus the same key order / serialisation (what ends up in localStorage and in files)
const same = (a, b, msg) => {
  assert.deepEqual(a, b, msg);
  assert.equal(JSON.stringify(a), JSON.stringify(b), `${msg || ""} (serialised form / key order)`);
};
// run the same call against both implementations, each with its own copy of the arguments
// (structuredClone keeps `undefined` arguments, JSON would turn them into null)
const both = (mod, fn, ...args) => [O[mod][fn](...structuredClone(args)), P[mod][fn](...structuredClone(args))];
const eq = (mod, fn, ...args) => {
  const [a, b] = both(mod, fn, ...args);
  same(b, a, `${mod}.${fn}`);
  return a;
};

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const randomRoster = (r, n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `X${i}`, name: `Person ${i}`, car: r() < 0.2, seats: 2 + Math.floor(r() * 4),
    legs: [r() < 0.9, r() < 0.9], team: pick(r, ["A", "B", "C", "D", ""]), lang: pick(r, ["DE", "EN", "RU", ""]), note: pick(r, ["", "", "Rollstuhl", "Gepäck"]),
  }));

const LIMITS = [undefined, { groupMax: 5, taxiSeats: 4 }, { groupMax: 2, taxiSeats: 2 }, { groupMax: 3, taxiSeats: 3 }, { groupMax: 8, taxiSeats: 4 }];
const ROSTERS = [O.planner.defaultPersons(), ...[3, 11, 29].map((s) => randomRoster(rng(s), 5 + s * 2))];
// a roster where people are missing on a leg and one driver only joins the second leg
const MIXED = O.planner.defaultPersons().map((p, i) => ({ ...p, legs: [i !== 10 && i % 7 !== 3, i !== 0 && i % 9 !== 5], seats: i === 20 ? 2 : p.seats }));
ROSTERS.push(MIXED);
const riderIds = (persons, leg) => persons.filter((p) => p.legs[leg] && !p.car).map((p) => p.id);

test("the module exports have the same names (plus EVENT in planner, initialLang instead of useLang in state)", () => {
  assert.deepEqual(Object.keys(P.planner).sort(), [...Object.keys(O.planner), "EVENT"].sort());
  for (const m of ["checks", "share", "tags"]) assert.deepEqual(Object.keys(P[m]).sort(), Object.keys(O[m]).sort(), m);
  assert.deepEqual(Object.keys(P.state).sort(), [...Object.keys(O.state).filter((k) => k !== "useLang"), "initialLang"].sort());
});

test("constants: EVENT, LEGS and every plain value", () => {
  same(P.planner.EVENT, O.agenda.EVENT, "EVENT");
  same(P.planner.LEGS, O.planner.LEGS, "LEGS");
  for (const m of Object.keys(P)) {
    for (const [k, v] of Object.entries(O[m])) if (typeof v !== "function") same(P[m][k], v, `${m}.${k}`);
  }
});

test("defaultPersons, nextName, normLang, tagOf", () => {
  const d = eq("planner", "defaultPersons");
  for (const n of [0, 1, 17, 39, 40]) eq("planner", "nextName", d.slice(0, n));
  eq("planner", "nextName", d.filter((_, i) => i % 3));
  for (const v of ["de", " Deutsch ", "German", "EN", "englisch", "ru", "Russisch", "русский", "РУССКИЙ", "", null, undefined, "TR", 0, 7, "constructor"]) {
    assert.equal(P.planner.normLang(v), O.planner.normLang(v), `normLang(${v})`);
  }
  for (const by of ["team", "lang", "none", undefined]) {
    for (const p of [{ team: "T", lang: "DE" }, { team: "", lang: "" }, {}]) assert.equal(P.planner.tagOf(p, by), O.planner.tagOf(p, by));
  }
});

test("newPerson / newRule: same shape and the same generated id (clock and random stubbed)", (t) => {
  t.mock.method(Date, "now", () => 1795000000000);
  t.mock.method(Math, "random", () => 0.123456789);
  same(P.planner.newPerson("Neu"), O.planner.newPerson("Neu"), "newPerson");
  same(P.planner.newPerson("Neu", { car: true, seats: 3, extra: 1 }), O.planner.newPerson("Neu", { car: true, seats: 3, extra: 1 }), "newPerson + extra");
  for (const type of [...O.checks.RULE_TYPES, "unknown"]) same(P.checks.newRule(type), O.checks.newRule(type), `newRule(${type})`);
});

test("planLeg: both legs x tram/taxi x none/team/lang x limits, on several rosters", () => {
  let n = 0;
  for (const persons of ROSTERS)
    for (const leg of [0, 1])
      for (const restBy of [undefined, "tram", "taxi"])
        for (const groupBy of [undefined, "none", "team", "lang"])
          for (const limits of LIMITS) {
            // trailing undefined arguments are passed as such: both sides must apply the same defaults
            const a = O.planner.planLeg(clone(persons), leg, restBy, limits, groupBy);
            const b = P.planner.planLeg(clone(persons), leg, restBy, limits, groupBy);
            same(b, a, `planLeg leg ${leg} ${restBy} ${groupBy} ${JSON.stringify(limits)}`);
            n++;
          }
  assert.ok(n >= 600);
});

test("baseLayout, reconcileLayout, copyLayoutToLeg, fixBuyers, newBoxId", () => {
  for (const persons of ROSTERS)
    for (const restBy of ["tram", "taxi"])
      for (const groupBy of ["none", "team", "lang"])
        for (const limits of LIMITS.slice(1)) {
          const plan = O.planner.planLeg(persons, 0, restBy, limits, groupBy);
          const lay = eq("planner", "baseLayout", plan, limits);
          same(P.planner.baseLayout(clone(plan)), O.planner.baseLayout(clone(plan)), "baseLayout with default limits");
          // manual edits: swap two riders, add times, one stale box time
          const edited = clone(lay);
          const [c1, c2] = edited.order.cars;
          if (c1 && c2 && edited.boxes[c1].length > 1 && edited.boxes[c2].length > 1) [edited.boxes[c1][1], edited.boxes[c2][1]] = [edited.boxes[c2][1], edited.boxes[c1][1]];
          edited.times = { c1: "14:50", g1: "14:45", gone: "10:00" };
          // the roster changes: every fifth rider leaves, three arrive; the limits change too
          const ids = riderIds(persons, 0).filter((_, i) => i % 5 !== 2).concat(["N1", "N2", "N3"]);
          for (const other of LIMITS.slice(1)) {
            eq("planner", "reconcileLayout", edited, ids, other, restBy);
            eq("planner", "reconcileLayout", { ...edited, times: undefined }, ids, other, restBy);
          }
          for (const to of [0, 1]) {
            const copy = eq("planner", "copyLayoutToLeg", edited, persons, to);
            eq("planner", "reconcileLayout", copy, riderIds(persons, to), limits, restBy);
          }
          eq("planner", "fixBuyers", { ...edited, buyers: { g1: "zzz", g2: "N1", g9: "q" } });
          for (const prefix of ["c", "g", "t", "x"]) eq("planner", "newBoxId", edited, prefix);
        }
  eq("planner", "fixBuyers", { boxes: { g1: ["a", "b", null], g2: [null, null, null] }, order: { cars: [], groups: ["g1", "g2"], taxis: [] }, buyers: { g1: "zzz", g2: "q" }, extra: 1 });
  eq("planner", "newBoxId", { boxes: { c1: 1, c7: 1, g12: 1 } }, "c");
  eq("planner", "newBoxId", { boxes: {} }, "g");
});

test("applyCounts: random targets, the mutated layout and the returned one", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const r = rng(seed * 7);
    const persons = seed % 10 === 0 ? MIXED : randomRoster(r, 8 + Math.floor(r() * 50));
    const limits = pick(r, LIMITS.slice(1));
    const lay = O.planner.baseLayout(O.planner.planLeg(persons, 0, pick(r, ["tram", "taxi"]), limits, "none"), limits);
    const cap = lay.order.cars.reduce((n, id) => n + lay.boxes[id].length, 0);
    const total = Object.values(lay.boxes).flatMap((s) => s.filter(Boolean)).length;
    const drivers = lay.order.cars.length;
    const car = drivers + Math.floor(r() * (Math.min(cap, total) - drivers + 1));
    const tram = Math.floor(r() * (total - car + 1));
    const target = { car, tram, taxi: total - car - tram };
    const a = clone(lay);
    const b = clone(lay);
    const ra = O.planner.applyCounts(a, target, limits);
    const rb = P.planner.applyCounts(b, target, limits);
    assert.equal(ra, a);
    assert.equal(rb, b, "the port also returns the layout it was given");
    same(b, a, `applyCounts seed ${seed} ${JSON.stringify(target)}`);
  }
});

test("parseRoster / exportCsv on a tricky CSV", () => {
  const csv = "\ufeffName;Auto;Plätze;Etappe 1;Etappe 2;Team;Sprache;Notiz\r\n" +
    "Anna Alt;ja;4;ja;nein;SAP PE;Deutsch;Rollstuhl\r\n" +
    "\"Bob, der\";nein;;;;Marketing;english;\r\n" +
    "Cem;x;9;0;1;;ru;\"Gepäck, groß\"\r\n" +
    "\"Zeile\r\nmit \"\"Umbruch\"\"; und Semikolon\";авто;3;-;hayır;T;русский;n\r\n" +
    "Dora;Ja;1;;;;xx;\r\n\r\n;;;\r\n  ;ja\rEve;да;2;falsch;no\n";
  const rows = eq("planner", "parseRoster", csv);
  assert.equal(rows.length, 6);
  eq("planner", "parseRoster", "Eva,ja,3\nFranz,nein,5");
  eq("planner", "parseRoster", "a,b;c\n\"x\"\"y\",1,2");
  eq("planner", "parseRoster", "");
  eq("planner", "parseRoster", "Name;Auto\n");
  eq("planner", "parseRoster", "name\nOnly Name\n\"open quote;ja;3");
  const table = [["Name", "Auto", "Notiz"], ...rows.map((p) => [p.name, p.car, p.note, p.seats, p.legs]), [null, undefined, 0, "", 'say "hi"; ok', "a\r\nb", false]];
  const [a, b] = [O.planner.exportCsv(table), P.planner.exportCsv(table)];
  assert.equal(b, a);
  assert.equal(b.charCodeAt(0), 0xfeff);
  // round trip through both parsers
  same(P.planner.parseRoster(b), O.planner.parseRoster(a), "export -> parse");
  assert.equal(P.planner.exportCsv([]), O.planner.exportCsv([]));
});

test("tagColors: values and the colour of every value", () => {
  for (const persons of [...ROSTERS, [], [{ team: "ä", lang: "x" }, { team: "Z", lang: "" }, { team: "a", lang: "x" }]])
    for (const by of ["team", "lang", "none", undefined]) {
      const a = O.tags.tagColors(persons, by);
      const b = P.tags.tagColors(persons, by);
      same(b.values, a.values, `tagColors values ${by}`);
      assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort());
      for (const v of [...a.values, "", null, undefined, "nope", "constructor"]) assert.equal(b.color(v), a.color(v), `color(${v})`);
    }
  // more values than colours: the palette wraps around
  const many = Array.from({ length: 20 }, (_, i) => ({ team: `T${i}`, lang: "" }));
  const [a, b] = [O.tags.tagColors(many, "team"), P.tags.tagColors(many, "team")];
  same(b.values.map(b.color), a.values.map(a.color), "wrapped colours");
});

test("computeChecks: built-in hints and several rules of every type", () => {
  const rulesFor = (persons) => {
    const id = (i) => (persons[i % persons.length] || {}).id || "";
    const rules = [];
    let n = 0;
    const add = (r) => rules.push({ id: `r${++n}`, level: n % 3 ? "warn" : "info", on: n % 11 !== 0, ...r });
    for (const mode of ["together", "apart"]) {
      for (const [a, b] of [[0, 1], [1, 2], [0, 6], [5, 17], [3, 3], [2, 23]]) add({ type: "pair", a: id(a), b: id(b), mode });
      add({ type: "pair", a: id(0), b: "nobody", mode });
      add({ type: "pair", a: "", b: id(1), mode });
    }
    for (const lang of ["DE", "EN", "RU", "", "XX"]) add({ type: "lang", lang });
    for (const team of ["*", "A", "SAP PE", "Finance", "", "none"]) for (const max of [0, 1, 2, 4]) add({ type: "teamMax", team, max });
    for (const rule of ["noTaxi", "noTram", "inCar", "notAlone", ""]) {
      for (const i of [0, 1, 4, 9, 12, 30]) add({ type: "person", p: id(i), rule });
      add({ type: "person", p: "nobody", rule });
      for (const keyword of ["rollstuhl", " GEP ", "gibt es nicht", "  ", "l"]) add({ type: "note", keyword, rule });
    }
    add({ type: "bogus" });
    return rules;
  };
  let hints = 0;
  const types = new Set();
  for (const persons of ROSTERS)
    for (const restBy of ["tram", "taxi"])
      for (const limits of LIMITS.slice(1)) {
        const layouts = [0, 1].map((leg) => ({ layout: O.planner.baseLayout(O.planner.planLeg(persons, leg, restBy, limits, "team"), limits) }));
        // make the plan imperfect: empty a seat, add an empty group and an empty taxi
        const l = layouts[0].layout;
        if (l.order.cars[0] && l.boxes[l.order.cars[0]].length > 1) l.boxes[l.order.cars[0]][1] = null;
        l.boxes.g90 = Array(limits.groupMax).fill(null);
        l.order.groups.push("g90");
        l.boxes.t90 = Array(limits.taxiSeats).fill(null);
        l.order.taxis.push("t90");
        const rules = rulesFor(persons);
        for (const groupBy of ["none", "team", "lang"]) {
          const out = eq("checks", "computeChecks", { persons, layouts, groupBy, limits, rules });
          hints += out.length;
          out.filter((c) => c.code === "rule").forEach((c) => types.add(c.args.type));
          eq("checks", "computeChecks", { persons, layouts, groupBy, limits }); // rules left out: the default applies
        }
      }
  assert.ok(hints > 500, `the cases produce hints (${hints})`);
  assert.deepEqual([...types].sort(), [...O.checks.RULE_TYPES].sort(), "every rule type fired at least once");
  // nobody on a leg, lone taxi, car that is not there
  const person = (id, extra = {}) => ({ id, name: id.toUpperCase(), car: false, seats: 5, legs: [true, true], team: "", lang: "", note: "", ...extra });
  const mk = (boxes, order) => ({ layout: { boxes, order: { cars: [], groups: [], taxis: [], ...order }, buyers: {}, times: {} } });
  eq("checks", "computeChecks", { persons: [person("a", { legs: [true, false] })], layouts: [mk({ t1: ["a", null, null, null], t2: ["b", "c", null, null] }, { taxis: ["t1", "t2"] }), mk({}, {})], groupBy: "none", limits: { groupMax: 5, taxiSeats: 4 } });
  eq("checks", "computeChecks", { persons: [person("d1", { car: true, legs: [false, true] }), person("a")], layouts: [mk({ t1: ["a", null, null, null] }, { taxis: ["t1"] }), mk({ c1: ["d1", "a", null, null, null] }, { cars: ["c1"] })], groupBy: "lang", limits: { groupMax: 5, taxiSeats: 4 } });
});

test("ruleReady / cleanRules", (t) => {
  t.mock.method(Date, "now", () => 1795000000000);
  t.mock.method(Math, "random", () => 0.987654321);
  const rules = [
    { type: "pair", on: true, a: "a", b: "b" }, { type: "pair", on: true, a: "a", b: "" }, { type: "pair", on: true, a: "a", b: "a" }, { type: "pair", on: false, a: "a", b: "b" },
    { type: "person", on: true, p: "", rule: "noTaxi" }, { type: "person", on: true, p: "x", rule: "noTaxi" }, { type: "note", on: true, keyword: "  ", rule: "noTaxi" },
    { type: "note", on: true, keyword: "x", rule: "noTaxi" }, { type: "note", on: true, rule: "noTaxi" }, { type: "lang", on: true, lang: "DE" }, { type: "lang", on: true },
    { type: "teamMax", on: true, team: "*", max: 2 }, { type: "teamMax", on: true, team: "*", max: 0 }, { type: "teamMax", on: true, team: "", max: 3 }, { type: "nonsense", on: true },
  ];
  for (const r of rules) assert.equal(P.checks.ruleReady(r), O.checks.ruleReady(r), JSON.stringify(r));
  eq("checks", "cleanRules", [{ id: "1", type: "pair", a: "x", b: "x" }, { id: "2", type: "bogus" }, null, { id: 3, type: "lang", level: "info", on: false, zzz: 1 }, { type: "lang" },
    { id: "5", type: "teamMax", max: 7, level: "loud" }, { id: "6", type: "person", p: "P01" }, { id: "7", type: "note", keyword: "k", on: 0 }, ...rules.map((r, i) => ({ ...r, id: `x${i}` }))]);
  for (const v of ["nope", undefined, null, {}, []]) eq("checks", "cleanRules", v);
});

test("buildCards / cardText", () => {
  const t = { car: "Auto", driver: "Fahrer:in", group: "Gruppe", buyer: "Gruppenticket", taxi: "Taxi", passengers: "Mitfahrer", members: "Mit" };
  for (const persons of ROSTERS)
    for (const restBy of ["tram", "taxi"])
      for (const limits of LIMITS.slice(1)) {
        const lay = O.planner.baseLayout(O.planner.planLeg(persons, 1, restBy, limits, "lang"), limits);
        lay.boxes.g90 = Array(limits.groupMax).fill(null);
        lay.order.groups.push("g90");
        lay.boxes.t90 = Array(limits.taxiSeats).fill(null);
        lay.order.taxis.push("t90");
        const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
        const cards = eq("share", "buildCards", lay, byId, t);
        for (const c of cards) for (const head of ["Etappe 2", "", null]) assert.equal(P.share.cardText(c, head, t), O.share.cardText(c, head, t));
      }
  // a car with only the driver: the dash for "nobody"
  const lone = { id: "c1", kind: "car", title: "Auto 1", lead: ["Fahrer:in", "X"], people: [] };
  assert.equal(P.share.cardText(lone, "H", t), O.share.cardText(lone, "H", t));
  assert.match(P.share.cardText(lone, "H", t), /Mitfahrer: \u2013$/);
});

test("copyText: clipboard API, fallback to the textarea, both failing", async () => {
  const hadNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const hadDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
  const setNav = (value) => Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
  const fakeDoc = (exec) => {
    const log = [];
    globalThis.document = {
      createElement: (tag) => ({ tag, style: {}, select() { log.push(`select:${this.value}:${this.style.position}:${this.style.opacity}`); }, remove() { log.push("remove"); } }),
      body: { appendChild: (el) => log.push(`append:${el.tag}`) },
      execCommand: (cmd) => { log.push(cmd); return exec(); },
    };
    return log;
  };
  try {
    const cases = [
      ["clipboard works", { clipboard: { writeText: async () => {} } }, () => true],
      ["clipboard rejects, execCommand works", { clipboard: { writeText: async () => { throw new Error("denied"); } } }, () => true],
      ["no clipboard API, execCommand says no", {}, () => false],
      ["clipboard throws synchronously, execCommand throws", { clipboard: { writeText: () => { throw new Error("x"); } } }, () => { throw new Error("no"); }],
    ];
    for (const [label, nav, exec] of cases) {
      const res = [];
      const logs = [];
      for (const impl of [O, P]) {
        setNav(nav);
        const log = fakeDoc(exec);
        res.push(await impl.share.copyText("hello"));
        logs.push(log);
      }
      assert.equal(res[1], res[0], label);
      assert.deepEqual(logs[1], logs[0], label);
    }
  } finally {
    if (hadNav) Object.defineProperty(globalThis, "navigator", hadNav); else delete globalThis.navigator;
    if (hadDoc) Object.defineProperty(globalThis, "document", hadDoc); else delete globalThis.document;
  }
});

test("initialDoc: first start and saved documents", () => {
  eq("state", "initialDoc", undefined);
  eq("state", "initialDoc", null);
  eq("state", "initialDoc", {});
  const d = O.planner.defaultPersons();
  const edits = { 0: { key: "0|tram|none|P01:5", layout: O.planner.baseLayout(O.planner.planLeg(d, 0)) } };
  const rules = [{ id: "a", type: "pair", a: "P01", b: "P01" }, { id: 7, type: "lang", level: "info" }, { id: "z", type: "bogus" }];
  // an older saved test list: four teams, no language, no note
  const old = d.map(({ note, lang, ...p }, i) => ({ ...p, team: ["", "SAP PE", "TRBK", "Marketing", "Projektleitung"][i % 5], ...(i % 2 ? { lang: "english" } : {}) }));
  eq("state", "initialDoc", { persons: old, restBy: "taxi", groupBy: "lang", limits: { groupMax: 7, taxiSeats: 3 }, edits, rules });
  eq("state", "initialDoc", { persons: old.slice(0, 5).concat([{ id: "Z1", name: "Own Person", car: true, seats: 4, legs: [true, false], lang: "Russisch" }]), restBy: "bus", groupBy: "x", limits: { groupMax: 9, taxiSeats: 1 } });
  // own teams: the list is left alone
  eq("state", "initialDoc", { persons: d.map((p, i) => ({ ...p, team: i ? p.team : "Own Team" })), groupBy: "team", limits: null, edits: null, rules: "x" });
  eq("state", "initialDoc", { persons: [{ id: "A", name: "A", legs: [true, true], lang: "xx" }], limits: { groupMax: 2.5, taxiSeats: "3" } });
  eq("state", "refreshTestTeams", old);
  eq("state", "refreshTestTeams", []);
  // lists that need no change come back as the same array
  const own = [{ id: "Q", name: "Q", team: "X" }];
  assert.equal(P.state.refreshTestTeams(own), own);
  assert.equal(O.state.refreshTestTeams(own), own);
});

test("docReducer: edits, undo, redo, no-op edits and the history limit", () => {
  const run = (impl) => {
    const trace = [];
    let s = { doc: impl.state.initialDoc(undefined), past: [], future: [] };
    const step = (a) => {
      const next = impl.state.docReducer(s, a);
      trace.push({ same: next === s, state: clone(next) });
      s = next;
    };
    step({ type: "undo" });
    step({ type: "redo" });
    step({ type: "edit", fn: (d) => ({ ...d, restBy: "taxi" }) });
    step({ type: "edit", fn: (d) => ({ ...d, groupBy: "team" }) });
    step({ type: "edit", fn: (d) => d });
    step({ type: "undo" });
    step({ type: "undo" });
    step({ type: "undo" });
    step({ type: "redo" });
    step({ type: "edit", fn: (d) => ({ ...d, limits: { groupMax: 3, taxiSeats: 2 } }) });
    step({ type: "redo" });
    return { trace, s };
  };
  const [a, b] = [run(O), run(P)];
  same(b.trace, a.trace, "docReducer trace");
  // more than 60 steps: the oldest ones fall out, on both sides alike
  const long = (impl) => {
    let s = { doc: { n: 0 }, past: [], future: [] };
    for (let i = 1; i <= 75; i++) s = impl.state.docReducer(s, { fn: (d) => ({ n: d.n + 1 }) });
    for (let i = 0; i < 70; i++) s = impl.state.docReducer(s, { type: "undo" });
    for (let i = 0; i < 3; i++) s = impl.state.docReducer(s, { type: "redo" });
    return s;
  };
  same(long(P), long(O), "history limit");
  assert.equal(long(P).past.length + long(P).future.length, 60);
});

test("normOrder, sameOrder, loadLayouts, loadState, structKeyOf, isDriverPos, clampLimit", (t) => {
  for (const o of [undefined, null, "x", [], ["cards", "leg"], ["cards", "cards", "bogus", "plan", 3], [...O.state.SECTION_KEYS].reverse()]) {
    const a = eq("state", "normOrder", o);
    assert.equal(P.state.sameOrder(a, O.state.SECTION_KEYS), O.state.sameOrder(a, O.state.SECTION_KEYS));
  }
  for (const [a, b] of [[[], []], [["a"], ["a"]], [["a"], ["b"]], [["a"], ["a", "b"]]]) assert.equal(P.state.sameOrder(a, b), O.state.sameOrder(a, b));

  // no localStorage at all (node): the defaults
  const store = {};
  const stub = { getItem: (k) => (k in store ? store[k] : null) };
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const setLs = (value) => Object.defineProperty(globalThis, "localStorage", { value, configurable: true, writable: true });
  t.after(() => (had ? Object.defineProperty(globalThis, "localStorage", had) : delete globalThis.localStorage));
  setLs(undefined);
  same(P.state.loadLayouts(), O.state.loadLayouts(), "loadLayouts without storage");
  same(P.state.loadLayouts(), { variants: [], activeId: null, order: O.state.SECTION_KEYS }, "loadLayouts defaults");
  assert.equal(P.state.loadLayouts().order, P.state.SECTION_KEYS, "the default order is the SECTION_KEYS array itself, as in the original");
  assert.equal(O.state.loadLayouts().order, O.state.SECTION_KEYS);
  assert.equal(P.state.loadState(), null);
  assert.equal(O.state.loadState(), null);

  setLs(stub);
  same(P.state.loadLayouts(), O.state.loadLayouts(), "loadLayouts, empty storage");
  assert.equal(P.state.loadState(), O.state.loadState());
  const stored = [
    "not json", "null", "{}", "[]",
    JSON.stringify({ variants: [{ id: 1, name: "A", order: ["cards"] }, { id: "b", name: 5 }, null, { name: "no id" }, { id: "c", name: "C" }], activeId: "c", order: ["people", "leg", "x"] }),
    JSON.stringify({ variants: "x", activeId: 1, order: null }),
    JSON.stringify({ variants: [{ id: 1, name: "A" }], activeId: 1 }),
  ];
  for (const s of stored) {
    store[O.state.LAYOUT_STORE] = s;
    same(P.state.loadLayouts(), O.state.loadLayouts(), `loadLayouts ${s}`);
  }
  const docs = ["not json", "null", "{}", JSON.stringify({ persons: "x" }), JSON.stringify({ persons: [{ id: "a", name: "A", legs: [true, true] }], restBy: "taxi" }), JSON.stringify({ persons: [{ id: "a", name: "", legs: [] }] }), JSON.stringify({ persons: [null] }), JSON.stringify({ persons: [] })];
  for (const s of docs) {
    store[O.state.STORE] = s;
    same(P.state.loadState(), O.state.loadState(), `loadState ${s}`);
  }

  for (const persons of ROSTERS)
    for (const leg of [0, 1])
      for (const restBy of ["tram", "taxi"])
        for (const groupBy of ["none", "team", "lang"]) assert.equal(P.state.structKeyOf(persons, leg, restBy, groupBy), O.state.structKeyOf(persons, leg, restBy, groupBy));
  assert.equal(P.state.structKeyOf(O.planner.defaultPersons(), 0, "tram", "none"), "0|tram|none|P01:5,P11:5,P21:5,P31:5");
  for (const pos of [{ car: "c1", idx: 0 }, { car: "c1", idx: 1 }, { car: "g1", idx: 0 }, { car: "t2", idx: 3 }]) assert.equal(P.state.isDriverPos(pos), O.state.isDriverPos(pos));
  for (const v of [undefined, null, 1, 2, 5, 8, 9, 2.5, "3", NaN]) {
    assert.equal(P.state.clampLimit(v, 5), O.state.clampLimit(v, 5), `clampLimit(${v})`);
    assert.equal(P.state.clampLimit(v, 4, [2, 4]), O.state.clampLimit(v, 4, [2, 4]), `clampLimit(${v}, taxi range)`);
    assert.equal(P.state.clampLimit(v, 4, undefined), O.state.clampLimit(v, 4, undefined));
  }
});

test("initialLang: query parameter, then the stored language, else German (the initializer of useLang)", (t) => {
  const hadW = Object.getOwnPropertyDescriptor(globalThis, "window");
  const hadLs = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => {
    if (hadW) Object.defineProperty(globalThis, "window", hadW); else delete globalThis.window;
    if (hadLs) Object.defineProperty(globalThis, "localStorage", hadLs); else delete globalThis.localStorage;
  });
  const set = (search, stored) => {
    Object.defineProperty(globalThis, "window", { value: { location: { search } }, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", { value: stored === "throws" ? { getItem() { throw new Error("blocked"); } } : { getItem: (k) => (k === "carpool-lang" ? stored : null) }, configurable: true, writable: true });
  };
  for (const [search, stored, want] of [["", null, "de"], ["?lang=en", "ru", "en"], ["?lang=xx", "ru", "ru"], ["?x=1", "en", "en"], ["?lang=ru", "throws", "ru"], ["", "throws", "de"], ["", "tr", "de"], ["?lang=", null, "de"]]) {
    set(search, stored);
    assert.equal(P.state.initialLang(), want, `${search} / ${stored}`);
  }
});
