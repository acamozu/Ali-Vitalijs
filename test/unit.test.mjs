// Logic tests (no browser): plan, counts, merge of manual edits, copy of a leg, hints, custom rules, CSV.
// Ported from the React app (tests/unit.test.mjs); the same tests run against the SAPUI5 modules in webapp/model.
// Run: node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./amd.mjs";

const {
  LEGS, CAR_SEATS, MIN_SEATS, DEFAULT_LIMITS, LIMIT_RANGE, TAXI_RANGE, LANG_OPTIONS,
  defaultPersons, newPerson, nextName, normLang, tagOf, planLeg, baseLayout, applyCounts, reconcileLayout,
  copyLayoutToLeg, fixBuyers, newBoxId, parseRoster,
} = load("planner");
const { computeChecks, ruleReady, newRule, cleanRules, RULE_TYPES } = load("checks");
const { tagColors, NO_TAG } = load("tags");
const { buildCards, cardText } = load("share");

// ---------- helpers ----------
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
const TEAMS = ["A", "B", "C", "D", ""];

function randomRoster(r, n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `X${i}`, name: `Person ${i}`, car: r() < 0.2, seats: MIN_SEATS + Math.floor(r() * (CAR_SEATS - MIN_SEATS + 1)),
    legs: [r() < 0.9, r() < 0.9], team: pick(r, TEAMS), lang: pick(r, [...LANG_OPTIONS, ""]), note: "",
  }));
}
const randomLimits = (r) => ({
  groupMax: LIMIT_RANGE[0] + Math.floor(r() * (LIMIT_RANGE[1] - LIMIT_RANGE[0] + 1)),
  taxiSeats: TAXI_RANGE[0] + Math.floor(r() * (TAXI_RANGE[1] - TAXI_RANGE[0] + 1)),
});
const layoutOf = (persons, leg, restBy, limits, groupBy) => baseLayout(planLeg(persons, leg, restBy, limits, groupBy), limits);
const placed = (lay) => Object.values(lay.boxes).flatMap((s) => s.filter(Boolean));
const riderIds = (persons, leg) => persons.filter((p) => p.legs[leg] && !p.car).map((p) => p.id);

// the invariants every layout must keep
function assertValid(lay, persons, leg, limits, label = "") {
  const active = persons.filter((p) => p.legs[leg]);
  const ids = placed(lay);
  assert.equal(new Set(ids).size, ids.length, `${label}: somebody is placed twice`);
  assert.deepEqual([...ids].sort(), active.map((p) => p.id).sort(), `${label}: placed people differ from the people on the leg`);
  const drivers = active.filter((p) => p.car);
  assert.deepEqual(lay.order.cars.map((id) => lay.boxes[id][0]).sort(), drivers.map((p) => p.id).sort(), `${label}: cars and drivers do not match`);
  lay.order.cars.forEach((id) => {
    const d = persons.find((p) => p.id === lay.boxes[id][0]);
    assert.equal(lay.boxes[id].length, d.seats, `${label}: car size is not the seat count`);
  });
  lay.order.groups.forEach((id) => assert.equal(lay.boxes[id].length, limits.groupMax, `${label}: group box size`));
  lay.order.taxis.forEach((id) => assert.equal(lay.boxes[id].length, limits.taxiSeats, `${label}: taxi box size`));
  // order lists and boxes agree
  assert.deepEqual(Object.keys(lay.boxes).sort(), [...lay.order.cars, ...lay.order.groups, ...lay.order.taxis].sort(), `${label}: order / boxes mismatch`);
  lay.order.groups.forEach((id) => {
    const m = lay.boxes[id].filter(Boolean);
    if (m.length) assert.ok(m.includes(lay.buyers[id]), `${label}: group ${id} has no valid ticket buyer`);
  });
}

// ---------- test data ----------
test("default test data: 40 people, 4 drivers, 5 teams, languages DE/EN/RU, two notes", () => {
  const d = defaultPersons();
  assert.equal(d.length, 40);
  assert.equal(new Set(d.map((p) => p.id)).size, 40);
  assert.equal(d.filter((p) => p.car).length, 4);
  assert.equal(new Set(d.map((p) => p.team)).size, 5);
  assert.ok(d.every((p) => LANG_OPTIONS.includes(p.lang)));
  assert.deepEqual(d.filter((p) => p.note).map((p) => p.note).sort(), ["Gepäck", "Rollstuhl"]);
  assert.ok(d.every((p) => p.legs.length === 2 && p.legs.every(Boolean)));
});

test("legs come from the agenda: hotel -> police headquarters at 15:00 -> Casa Isoletta at 18:00", () => {
  assert.equal(LEGS.length, 2);
  assert.equal(LEGS[0].time, "15:00");
  assert.equal(LEGS[1].time, "18:00");
  assert.match(LEGS[0].from.name.de, /Marriott/);
  assert.match(LEGS[0].to.name.de, /Polizei/);
  assert.match(LEGS[1].to.name.de, /Casa Isoletta/);
});

test("nextName gives unused fictional names, then numbered ones", () => {
  const d = defaultPersons();
  assert.match(nextName(d), /^Person 41$/);
  assert.equal(nextName(d.slice(0, 39)), d[39].name);
  assert.ok(newPerson("Neu").id && newPerson("Neu").note === "" && newPerson("Neu").legs.every(Boolean));
});

test("normLang accepts codes and words in German, English and Russian, nothing else", () => {
  for (const [v, w] of [["de", "DE"], [" Deutsch ", "DE"], ["German", "DE"], ["EN", "EN"], ["englisch", "EN"], ["English", "EN"], ["ru", "RU"], ["Russisch", "RU"], ["russian", "RU"], ["русский", "RU"]]) assert.equal(normLang(v), w);
  for (const v of ["", null, undefined, "TR", "turkish", "xx"]) assert.equal(normLang(v), "");
});

// ---------- the plan ----------
test("default plan: 4 cars of 5, 4 tram groups of 5, nobody in a taxi", () => {
  const lay = layoutOf(defaultPersons(), 0, "tram", DEFAULT_LIMITS, "none");
  assert.equal(lay.order.cars.length, 4);
  assert.equal(lay.order.groups.length, 4);
  assert.equal(lay.order.taxis.length, 0);
  assertValid(lay, defaultPersons(), 0, DEFAULT_LIMITS, "default");
  assert.ok(lay.order.cars.every((id) => lay.boxes[id].every(Boolean)));
});

test("rest by taxi: nobody in a tram group, taxis hold at most the taxi seats", () => {
  const p = defaultPersons();
  const lay = layoutOf(p, 0, "taxi", DEFAULT_LIMITS, "none");
  assert.equal(lay.order.groups.length, 0);
  assert.equal(lay.order.taxis.length, 5);
  assertValid(lay, p, 0, DEFAULT_LIMITS, "taxi");
});

test("a leftover of fewer than 3 goes to a taxi instead of a one-person tram group", () => {
  const p = defaultPersons().slice(0, 22); // 2 drivers carry 8, 14 riders... make it exact below
  const persons = Array.from({ length: 12 }, (_, i) => ({ id: `Q${i}`, name: `Q${i}`, car: i === 0, seats: 5, legs: [true, true], team: "", lang: "", note: "" }));
  // 1 driver + 4 passengers, 7 left: 5 + 2 -> the 2 go to a taxi
  const lay = layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none");
  assert.equal(lay.order.groups.length, 1);
  assert.equal(lay.order.taxis.length, 1);
  assert.equal(lay.boxes[lay.order.taxis[0]].filter(Boolean).length, 2);
  void p;
});

test("random rosters: every plan is valid (200 cases, all limits, both rest modes, all groupings)", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed);
    const persons = randomRoster(r, 1 + Math.floor(r() * 60));
    const limits = randomLimits(r);
    const restBy = r() < 0.5 ? "tram" : "taxi";
    const groupBy = pick(r, ["none", "team", "lang"]);
    for (const leg of [0, 1]) assertValid(layoutOf(persons, leg, restBy, limits, groupBy), persons, leg, limits, `seed ${seed} leg ${leg} ${restBy} ${groupBy}`);
  }
});

test("grouping by team keeps teams together: more same-team neighbours than without grouping", () => {
  const persons = defaultPersons().map((p) => ({ ...p, car: false })); // no cars: everybody sits in tram groups
  const sameTeamPairs = (lay) => lay.order.groups.reduce((n, id) => {
    const m = lay.boxes[id].filter(Boolean).map((x) => persons.find((p) => p.id === x).team);
    return n + m.filter((t, i) => m.indexOf(t) !== i).length;
  }, 0);
  const none = sameTeamPairs(layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none"));
  const team = sameTeamPairs(layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "team"));
  assert.ok(team > none, `team grouping (${team}) should beat none (${none})`);
  assert.ok(team >= 24, `at least 24 of 40 people share a group with a team mate (got ${team})`);
});

// ---------- counts ----------
test("applyCounts moves people between car / tram / taxi and keeps everybody (150 random cases)", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 7);
    const persons = randomRoster(r, 8 + Math.floor(r() * 50));
    const limits = randomLimits(r);
    const lay = layoutOf(persons, 0, "tram", limits, "none");
    const cars = lay.order.cars.reduce((n, id) => n + lay.boxes[id].filter(Boolean).length, 0);
    const cap = lay.order.cars.reduce((n, id) => n + lay.boxes[id].length, 0);
    const total = placed(lay).length;
    const drivers = lay.order.cars.length;
    const car = drivers + Math.floor(r() * (Math.min(cap, total) - drivers + 1));
    const tram = Math.floor(r() * (total - car + 1));
    const target = { car, tram, taxi: total - car - tram };
    const copy = JSON.parse(JSON.stringify(lay));
    applyCounts(copy, target, limits);
    const n = (ids) => ids.reduce((s, id) => s + copy.boxes[id].filter(Boolean).length, 0);
    assert.equal(n(copy.order.cars), target.car, `seed ${seed}: car`);
    assert.equal(n(copy.order.groups), target.tram, `seed ${seed}: tram`);
    assert.equal(n(copy.order.taxis), target.taxi, `seed ${seed}: taxi`);
    void cars;
    assertValid(fixBuyers(copy), persons, 0, limits, `counts seed ${seed}`);
  }
});

// ---------- merging manual edits ----------
test("reconcileLayout: people who left disappear, newcomers get a free place, sizes follow the limits (150 random cases)", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 13);
    const persons = randomRoster(r, 10 + Math.floor(r() * 40));
    const limits = randomLimits(r);
    const restBy = r() < 0.5 ? "tram" : "taxi";
    const stored = layoutOf(persons, 0, restBy, limits, "none");
    // the roster changes: some riders leave, some arrive, the limits change - the drivers stay
    const changed = persons.filter((p) => p.car || r() > 0.2).map((p) => ({ ...p }));
    const extra = Array.from({ length: Math.floor(r() * 6) }, (_, i) => ({ id: `N${seed}_${i}`, name: `New ${i}`, car: false, seats: 5, legs: [true, true], team: "", lang: "", note: "" }));
    const next = [...changed, ...extra];
    const newLimits = randomLimits(r);
    const lay = reconcileLayout(stored, riderIds(next, 0), newLimits, restBy);
    assertValid(lay, next.map((p) => (p.legs[0] ? p : { ...p, legs: [false, p.legs[1]] })).filter((p) => p.legs[0]).concat([]), 0, newLimits, `reconcile seed ${seed}`);
  }
});

test("reconcileLayout keeps manual moves and departure times", () => {
  const persons = defaultPersons();
  const lay = layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none");
  const swap = JSON.parse(JSON.stringify(lay));
  [swap.boxes.c1[1], swap.boxes.c2[1]] = [swap.boxes.c2[1], swap.boxes.c1[1]];
  swap.times = { c2: "14:50", g1: "14:45", gone: "10:00" };
  const out = reconcileLayout(swap, riderIds(persons, 0), DEFAULT_LIMITS, "tram");
  assert.equal(out.boxes.c1[1], swap.boxes.c1[1]);
  assert.equal(out.boxes.c2[1], swap.boxes.c2[1]);
  assert.deepEqual(out.times, { c2: "14:50", g1: "14:45" }, "times of boxes that do not exist are dropped, the others stay");
});

test("shrinking a group size re-places the people who no longer fit (nobody is lost)", () => {
  const persons = defaultPersons();
  const lay = layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none");
  const small = { ...DEFAULT_LIMITS, groupMax: 3 };
  const out = reconcileLayout(lay, riderIds(persons, 0), small, "tram");
  assertValid(out, persons, 0, small, "shrink");
  assert.ok(out.order.groups.length >= 6);
});

// ---------- copy leg 1 -> leg 2 ----------
test("copyLayoutToLeg: same cars / groups, absent people fall out, a driver only on the target leg gets a car", () => {
  const persons = defaultPersons().map((p) => ({ ...p, legs: [...p.legs] }));
  persons[10].legs = [false, true]; // driver P11 only on leg 2
  persons[0].legs = [true, false]; // driver P01 only on leg 1
  persons[7].legs = [true, false]; // rider only on leg 1
  const lay1 = layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none");
  const moved = JSON.parse(JSON.stringify(lay1));
  [moved.boxes.c2[1], moved.boxes.c3[1]] = [moved.boxes.c3[1], moved.boxes.c2[1]]; // a manual change on leg 1
  const copy = copyLayoutToLeg(moved, persons, 1);
  assert.ok(!copy.order.cars.some((id) => copy.boxes[id][0] === "P01"), "driver only on leg 1 has no car on leg 2");
  assert.ok(copy.order.cars.some((id) => copy.boxes[id][0] === "P11"), "driver only on leg 2 got an empty car");
  assert.deepEqual(copy.times, {});
  const lay2 = reconcileLayout(copy, riderIds(persons, 1), DEFAULT_LIMITS, "tram");
  assertValid(lay2, persons, 1, DEFAULT_LIMITS, "copy");
  // people on both legs that sat in a group / taxi stay together
  const groupOf = (lay, id) => lay.order.groups.find((g) => lay.boxes[g].includes(id));
  for (const p of persons.filter((p) => !p.car && p.legs[0] && p.legs[1])) {
    if (groupOf(moved, p.id) && groupOf(lay2, p.id)) assert.equal(groupOf(lay2, p.id), groupOf(moved, p.id), `${p.id} changed group`);
  }
  assert.equal(newBoxId({ boxes: { c1: 1, c7: 1 } }, "c"), "c8");
});

test("fixBuyers: a missing buyer becomes the first member, empty groups lose theirs", () => {
  const lay = { boxes: { g1: ["a", "b", null], g2: [null, null, null] }, order: { cars: [], groups: ["g1", "g2"], taxis: [] }, buyers: { g1: "zzz", g2: "q" } };
  const out = fixBuyers(lay);
  assert.equal(out.buyers.g1, "a");
  assert.equal(out.buyers.g2, undefined);
});

// ---------- hints ----------
const T0 = { car: 0, tram: 0, taxi: 0 };
const mk = (boxes, order, buyers = {}) => ({ layout: { boxes, order: { cars: [], groups: [], taxis: [], ...order }, buyers, times: {} } });
const person = (id, extra = {}) => ({ id, name: id.toUpperCase(), car: false, seats: 5, legs: [true, true], team: "", lang: "", note: "", ...extra });
const codes = (checks, leg = 0) => checks.filter((c) => c.leg === leg).map((c) => c.code).sort();

test("hints: the built-in checks fire exactly when they should", () => {
  const persons = [person("d1", { car: true }), person("a"), person("b"), person("c"), person("d")];
  const limits = DEFAULT_LIMITS;
  // car with only the driver while others take a taxi / tram group of 1
  let ch = computeChecks({ persons, layouts: [mk({ c1: ["d1", null, null, null, null], g1: ["a", null, null, null, null], t1: ["b", "c", "d", null] }, { cars: ["c1"], groups: ["g1"], taxis: ["t1"] }, { g1: "a" }), mk({}, {})], groupBy: "none", limits });
  assert.deepEqual(codes(ch), ["emptyCar", "freeSeats", "smallGroup"].sort());
  // lone taxi while another taxi has room
  ch = computeChecks({ persons, layouts: [mk({ t1: ["a", null, null, null], t2: ["b", "c", null, null] }, { taxis: ["t1", "t2"] }), mk({}, {})], groupBy: "none", limits });
  assert.ok(codes(ch).includes("lonelyTaxi"));
  // empty group and taxi are info, not warnings
  ch = computeChecks({ persons, layouts: [mk({ c1: ["d1", "a", "b", "c", "d"], g1: [null, null, null, null, null], t1: [null, null, null, null] }, { cars: ["c1"], groups: ["g1"], taxis: ["t1"] }), mk({}, {})], groupBy: "none", limits });
  assert.deepEqual(codes(ch), ["emptyBox", "emptyBox"]);
  assert.ok(ch.filter((c) => c.leg === 0).every((c) => c.level === "info"));
  // a car owner on leg 2 who is not on leg 1
  const p2 = [person("d1", { car: true, legs: [false, true] }), person("a")];
  ch = computeChecks({ persons: p2, layouts: [mk({ t1: ["a", null, null, null] }, { taxis: ["t1"] }), mk({ c1: ["d1", "a", null, null, null] }, { cars: ["c1"] })], groupBy: "none", limits });
  assert.ok(ch.some((c) => c.code === "carNotThere" && c.leg === 1));
  // nobody on a leg
  ch = computeChecks({ persons: [person("a", { legs: [true, false] })], layouts: [mk({ t1: ["a", null, null, null] }, { taxis: ["t1"] }), mk({}, {})], groupBy: "none", limits });
  assert.ok(ch.some((c) => c.code === "noPeople" && c.leg === 1));
  // mixed teams only matter while a grouping is chosen
  const pt = [person("a", { team: "X" }), person("b", { team: "Y" })];
  const lays = [mk({ t1: ["a", "b", null, null] }, { taxis: ["t1"] }), mk({ t1: ["a", "b", null, null] }, { taxis: ["t1"] })];
  assert.ok(!computeChecks({ persons: pt, layouts: lays, groupBy: "none", limits }).some((c) => c.code === "mixed"));
  assert.ok(computeChecks({ persons: pt, layouts: lays, groupBy: "team", limits }).some((c) => c.code === "mixed"));
  void T0;
});

test("custom rules: every type produces a hint when broken and stays quiet when kept", () => {
  const persons = [person("a", { team: "X", lang: "DE", note: "Rollstuhl" }), person("b", { team: "X", lang: "EN" }), person("c", { team: "Y", lang: "EN" }), person("d", { team: "Y", lang: "RU" })];
  const lay = mk({ t1: ["a", "b", null, null], t2: ["c", null, null, null], g1: ["d", null, null, null, null] }, { taxis: ["t1", "t2"], groups: ["g1"] }, { g1: "d" });
  const run = (rule) => computeChecks({ persons, layouts: [lay, mk({}, {})], groupBy: "none", limits: DEFAULT_LIMITS, rules: [{ id: "r", level: "warn", on: true, ...rule }] }).filter((c) => c.code === "rule" && c.leg === 0);
  // two people
  assert.equal(run({ type: "pair", a: "a", b: "c", mode: "together" }).length, 1);
  assert.equal(run({ type: "pair", a: "a", b: "b", mode: "together" }).length, 0);
  assert.equal(run({ type: "pair", a: "a", b: "b", mode: "apart" }).length, 1);
  assert.equal(run({ type: "pair", a: "a", b: "c", mode: "apart" }).length, 0);
  assert.equal(run({ type: "pair", a: "a", b: "a", mode: "apart" }).length, 0, "the same person twice is incomplete");
  // language per vehicle: t1 has DE+EN, t2 EN, g1 RU
  assert.equal(run({ type: "lang", lang: "DE" })[0].args.bad, 2);
  assert.equal(run({ type: "lang", lang: "EN" })[0].args.bad, 1);
  // team limit: t1 holds two people of team X
  assert.equal(run({ type: "teamMax", team: "*", max: 1 })[0].args.bad, 1);
  assert.equal(run({ type: "teamMax", team: "Y", max: 1 }).length, 0);
  assert.equal(run({ type: "teamMax", team: "*", max: 2 }).length, 0);
  // person rules
  assert.equal(run({ type: "person", p: "d", rule: "noTram" }).length, 1);
  assert.equal(run({ type: "person", p: "a", rule: "noTaxi" }).length, 1);
  assert.equal(run({ type: "person", p: "a", rule: "inCar" }).length, 1);
  assert.equal(run({ type: "person", p: "c", rule: "notAlone" }).length, 1);
  assert.equal(run({ type: "person", p: "a", rule: "notAlone" }).length, 0);
  assert.equal(run({ type: "person", p: "a", rule: "noTram" }).length, 0);
  // note rule (case-insensitive, one hint for everybody)
  assert.equal(run({ type: "note", keyword: "rollstuhl", rule: "noTaxi" })[0].args.count, 1);
  assert.equal(run({ type: "note", keyword: "ROLL", rule: "noTram" }).length, 0);
  assert.equal(run({ type: "note", keyword: "gibt es nicht", rule: "noTaxi" }).length, 0);
});

test("custom rules: inactive or incomplete rules are ignored and not counted", () => {
  assert.equal(ruleReady({ type: "pair", on: true, a: "a", b: "b" }), true);
  assert.equal(ruleReady({ type: "pair", on: true, a: "a", b: "" }), false);
  assert.equal(ruleReady({ type: "pair", on: true, a: "a", b: "a" }), false);
  assert.equal(ruleReady({ type: "pair", on: false, a: "a", b: "b" }), false);
  assert.equal(ruleReady({ type: "person", on: true, p: "", rule: "noTaxi" }), false);
  assert.equal(ruleReady({ type: "note", on: true, keyword: "  ", rule: "noTaxi" }), false);
  assert.equal(ruleReady({ type: "note", on: true, keyword: "x", rule: "noTaxi" }), true);
  assert.equal(ruleReady({ type: "lang", on: true, lang: "DE" }), true);
  assert.equal(ruleReady({ type: "teamMax", on: true, team: "*", max: 2 }), true);
  assert.equal(ruleReady({ type: "teamMax", on: true, team: "*", max: 0 }), false);
  assert.equal(ruleReady({ type: "nonsense", on: true }), false);
  const persons = [person("a"), person("b")];
  const lay = mk({ t1: ["a", "b", null, null] }, { taxis: ["t1"] });
  const out = computeChecks({ persons, layouts: [lay, mk({}, {})], groupBy: "none", limits: DEFAULT_LIMITS, rules: [{ id: "x", type: "pair", level: "warn", on: false, a: "a", b: "b", mode: "apart" }] });
  assert.ok(!out.some((c) => c.code === "rule"));
});

test("cleanRules: unknown types are dropped, defaults added, a pair of the same person loses the second", () => {
  const out = cleanRules([{ id: "1", type: "pair", a: "x", b: "x" }, { id: "2", type: "bogus" }, null, { id: "3", type: "lang" }, { type: "lang" }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].b, "");
  assert.equal(out[1].lang, "DE");
  assert.ok(out.every((r) => r.on === true && r.level === "warn"));
  assert.deepEqual(cleanRules("nope"), []);
  assert.deepEqual(RULE_TYPES, ["pair", "lang", "teamMax", "person", "note"]);
  for (const t of RULE_TYPES) assert.equal(newRule(t).type, t);
});

// ---------- CSV ----------
test("parseRoster: ; and , separators, BOM, quotes, header row, flags, seats, language words", () => {
  const csv = "﻿Name;Auto;Plätze;Etappe 1;Etappe 2;Team;Sprache;Notiz\r\n" +
    "Anna Alt;ja;4;ja;nein;SAP PE;Deutsch;Rollstuhl\r\n" +
    "\"Bob, der\";nein;;;;Marketing;english;\r\n" +
    "Cem;x;9;0;1;;ru;\"Gepäck, groß\"\r\n" +
    "Dora;Ja;1;;;;xx;\r\n\r\n;;;\r\n";
  const r = parseRoster(csv);
  assert.equal(r.length, 4);
  assert.deepEqual([r[0].name, r[0].car, r[0].seats, r[0].legs, r[0].team, r[0].lang, r[0].note], ["Anna Alt", true, 4, [true, false], "SAP PE", "DE", "Rollstuhl"]);
  assert.deepEqual([r[1].name, r[1].car, r[1].seats, r[1].legs, r[1].lang], ["Bob, der", false, CAR_SEATS, [true, true], "EN"]);
  assert.deepEqual([r[2].car, r[2].seats, r[2].legs, r[2].lang, r[2].note], [true, CAR_SEATS, [false, true], "RU", "Gepäck, groß"]);
  assert.deepEqual([r[3].car, r[3].seats, r[3].lang], [true, MIN_SEATS, ""]);
  assert.equal(new Set(r.map((p) => p.id)).size, 4);
  // comma separated, no header
  const c = parseRoster("Eva,ja,3\nFranz,nein,5");
  assert.deepEqual(c.map((p) => [p.name, p.car, p.seats]), [["Eva", true, 3], ["Franz", false, 5]]);
  assert.deepEqual(parseRoster(""), []);
  assert.deepEqual(parseRoster("Name;Auto\n"), []);
});

// ---------- colours, cards ----------
test("tagColors: stable colour per value, grey for empty", () => {
  const ps = defaultPersons();
  const a = tagColors(ps, "team");
  const b = tagColors([...ps].reverse(), "team");
  assert.deepEqual(a.values, b.values);
  assert.equal(a.values.length, 5);
  for (const v of a.values) assert.equal(a.color(v), b.color(v));
  assert.equal(a.color(""), NO_TAG);
  assert.equal(tagColors(ps, "none").values.length, 0);
  assert.equal(tagOf({ team: "T", lang: "DE" }, "team"), "T");
  assert.equal(tagOf({ team: "T", lang: "DE" }, "lang"), "DE");
  assert.equal(tagOf({ team: "T", lang: "DE" }, "none"), "");
});

test("cards and messages: one card per car / non-empty group / non-empty taxi, with driver / buyer lines", () => {
  const persons = defaultPersons();
  const lay = layoutOf(persons, 0, "taxi", DEFAULT_LIMITS, "none");
  const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
  const t = { car: "Auto", driver: "Fahrer:in", group: "Gruppe", buyer: "Gruppenticket", taxi: "Taxi", passengers: "Mitfahrer", members: "Mit" };
  const cards = buildCards(lay, byId, t);
  assert.equal(cards.length, lay.order.cars.length + lay.order.taxis.length);
  const car = cards.find((c) => c.kind === "car");
  assert.equal(car.lead[1], byId[lay.boxes[car.id][0]].name);
  assert.equal(car.people.length, 4);
  const text = cardText(car, "Etappe 1", t);
  assert.match(text, /^Etappe 1\nAuto 1\nFahrer:in: .+\nMitfahrer: .+,/);
  const tram = layoutOf(persons, 0, "tram", DEFAULT_LIMITS, "none");
  const tc = buildCards(tram, byId, t).filter((c) => c.kind === "tram");
  assert.equal(tc.length, 4);
  assert.ok(tc.every((c) => c.lead[0] === "Gruppenticket" && c.people.length === 4));
});
// ---------- Excel: export in every interface language, read back ----------
// excel.js, excelImport.js and text.js are not part of this port, so these three tests of the React app are skipped here.
for (const lang of ["de", "en", "ru"]) {
  test.skip(`Excel (${lang}): the exported plan reads back with the same people, cars and groups`, () => {});
}
