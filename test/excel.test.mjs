// The UI5 ports of the Excel export / import against the original React modules:
// the same plan must give the same workbook (sheets, cells, formulas, widths, styles, print setup) and read back the same.
// run: node --test test/excel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL = path.resolve(HERE, "../webapp/model");
const BUNDLE = path.resolve(HERE, "../webapp/lib/exceljs.min.js");
const SRC_REPO = path.resolve(HERE, "../../../../Ali-Vitalijs-event-agenda");
const SRC = path.join(SRC_REPO, "src/carpool");
const orig = (name) => import(pathToFileURL(path.join(SRC, `${name}.js`)).href);

// exceljs of the source repo (node build): used by the original modules and to read every result back
const NodeExcelJS = createRequire(path.join(SRC_REPO, "package.json"))("exceljs");

// the ported modules expect a browser: window, and the global ExcelJS that loadExcelJS() looks for.
// The global comes from the copied browser bundle itself (webapp/lib), evaluated like a script tag without AMD "define".
globalThis.window = globalThis;
new Function(readFileSync(BUNDLE, "utf8"))();

// ---------- AMD loading: the shared shim if present, otherwise an inline one ----------
const amdPath = path.join(HERE, "amd.mjs");
let loadPort;
if (existsSync(amdPath)) {
  loadPort = (await import(pathToFileURL(amdPath).href)).load;
} else {
  const cache = new Map();
  const loadFile = (file) => {
    if (cache.has(file)) return cache.get(file);
    let defined = null;
    const sap = { ui: { define: (deps, factory) => (defined = typeof deps === "function" ? { deps: [], factory: deps } : { deps, factory }) } };
    new Function("sap", readFileSync(file, "utf8"))(sap);
    const mod = defined.factory(...defined.deps.map((d) => loadFile(path.resolve(path.dirname(file), `${d}.js`))));
    cache.set(file, mod);
    return mod;
  };
  loadPort = (name) => loadFile(path.join(MODEL, `${name}.js`));
}
// a sibling that is not ported yet: the original ES module (same export names)
const sibling = async (name) => (existsSync(path.join(MODEL, `${name}.js`)) ? loadPort(name) : orig(name));

const O = { planner: await orig("planner"), state: await orig("state"), checks: await orig("checks"), text: await orig("text"), excel: await orig("excel"), excelImport: await orig("excelImport") };
const P = { excel: loadPort("excel"), excelImport: loadPort("excelImport"), text: await sibling("text") };
const { LEGS, DEFAULT_LIMITS, defaultPersons, planLeg, baseLayout } = O.planner;
const DATE = "27.11.2026";

// ---------- the plans under test ----------
function demoPlan() {
  const persons = defaultPersons(); // the 40 demo persons
  const limits = { ...DEFAULT_LIMITS };
  const layouts = LEGS.map((_, l) => {
    const plan = planLeg(persons, l, "tram", limits, "none");
    return { key: O.state.structKeyOf(persons, l, "tram", "none"), layout: baseLayout(plan, limits), away: plan.away };
  });
  return { persons, limits, layouts, restBy: ["tram", "tram"] };
}
// an edited plan: people who stay away, taxis on the second leg, own departure times, a note, a cabrio
function editedPlan() {
  const persons = defaultPersons();
  persons[7].legs = [true, false];
  persons[13].legs = [false, true];
  persons[21].note = "kommt später";
  persons[10].seats = 2;
  const limits = { groupMax: 4, taxiSeats: 3 };
  const restBy = ["tram", "taxi"];
  const layouts = LEGS.map((_, l) => {
    const plan = planLeg(persons, l, restBy[l], limits, "none");
    const layout = baseLayout(plan, limits);
    const [car] = layout.order.cars;
    const [box] = l === 0 ? layout.order.groups : layout.order.taxis;
    layout.times = { [car]: "08:05", [box]: "23:40" };
    // the last car of the first leg drives empty (a hint); its passengers are not placed anywhere
    if (l === 0) layout.boxes[layout.order.cars.at(-1)].fill(null, 1);
    return { key: O.state.structKeyOf(persons, l, restBy[l], "none"), layout, away: plan.away };
  });
  return { persons, limits, layouts, restBy };
}

// ---------- everything of a workbook that the export sets ----------
async function snapshot(blob) {
  const wb = new NodeExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  const plain = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
  return {
    creator: wb.creator,
    calcProperties: plain(wb.calcProperties),
    sheets: wb.worksheets.map((ws) => {
      const cells = {};
      const rows = {};
      ws.eachRow({ includeEmpty: true }, (row, n) => {
        rows[n] = row.height ?? null;
        row.eachCell({ includeEmpty: true }, (cell) => {
          cells[cell.address] = plain({ type: cell.type, value: cell.value, formula: cell.formula ?? null, result: cell.result ?? null, master: cell.master.address, style: cell.style });
        });
      });
      return {
        name: ws.name,
        widths: Array.from({ length: ws.columnCount }, (_, i) => ws.getColumn(i + 1).width ?? null),
        rowCount: ws.rowCount,
        rows,
        cells,
        merges: plain(ws.model.merges),
        views: plain(ws.views),
        pageSetup: plain(ws.pageSetup),
        autoFilter: plain(ws.autoFilter),
      };
    }),
  };
}

const PLANS = { demo: demoPlan, edited: editedPlan };
const built = {}; // `${plan}/${lang}` -> { o, p } blobs, reused by the round trips
async function build(planName, lang) {
  const id = `${planName}/${lang}`;
  if (!built[id]) {
    const plan = PLANS[planName]();
    const checks = O.checks.computeChecks({ persons: plan.persons, layouts: plan.layouts, groupBy: "none", limits: plan.limits, rules: [] });
    const args = (t) => ({ persons: plan.persons, layouts: plan.layouts, legs: LEGS, lang, t, checks, date: DATE });
    built[id] = { plan, checks, o: await O.excel.buildWorkbook(args(O.text.TEXT[lang])), p: await P.excel.buildWorkbook(args(O.text.TEXT[lang])), pOwnText: await P.excel.buildWorkbook(args(P.text.TEXT[lang])) };
  }
  return built[id];
}

test("the ported modules export what the originals export", () => {
  assert.deepEqual(Object.keys(P.excel).sort(), Object.keys(O.excel).sort());
  assert.deepEqual(Object.keys(P.excelImport).sort(), Object.keys(O.excelImport).sort());
  assert.deepEqual(P.excel.SYMBOLIC_PRICES, O.excel.SYMBOLIC_PRICES);
  assert.equal(typeof globalThis.ExcelJS.Workbook, "function", "the copied browser bundle sets the global ExcelJS");
});

for (const planName of Object.keys(PLANS)) {
  for (const lang of ["de", "en", "ru"]) {
    test(`export (${planName}, ${lang}): the port writes the same workbook as the original`, async () => {
      const b = await build(planName, lang);
      assert.ok(b.p instanceof Blob);
      assert.equal(b.p.type, b.o.type);
      const [so, sp, spt] = await Promise.all([snapshot(b.o), snapshot(b.p), snapshot(b.pOwnText)]);
      if (planName === "edited") assert.ok(b.checks.length > 0, "the edited plan has hints, so the hints sheet is written");
      assert.equal(so.sheets.length, 8 + (b.checks.length ? 1 : 0));
      assert.deepEqual(sp.sheets.map((s) => s.name), so.sheets.map((s) => s.name), "sheet names");
      so.sheets.forEach((s, i) => {
        const q = sp.sheets[i];
        assert.deepEqual(q.widths, s.widths, `${s.name}: column widths`);
        assert.deepEqual(q.rows, s.rows, `${s.name}: row heights`);
        assert.deepEqual(Object.keys(q.cells), Object.keys(s.cells), `${s.name}: used cells`);
        for (const addr of Object.keys(s.cells)) assert.deepEqual(q.cells[addr], s.cells[addr], `${s.name}!${addr}`);
        assert.deepEqual(q, s, `${s.name}: merges, views, print setup, filter`);
      });
      assert.deepEqual(sp, so);
      // spot checks, so that an empty comparison cannot pass
      const people = so.sheets.find((s) => s.name === O.text.TEXT[lang].xl.people);
      assert.equal(Object.keys(people.rows).length, 41);
      assert.equal(sp.sheets[1].pageSetup.orientation, "landscape");
      assert.equal(sp.sheets[1].pageSetup.printTitlesRow, "1:1");
      const costs = sp.sheets.find((s) => s.name === O.text.TEXT[lang].xl.costs);
      assert.equal(costs.cells.D8.formula, "B8*$B$3");
      assert.equal(costs.cells.F10.formula, "SUM(F8:F9)");
      assert.equal(costs.cells.B3.style.numFmt, '#,##0.00 "€"');
      assert.equal(costs.cells.B3.style.fill.fgColor.argb, "FFFFF3C4");
      // with the texts of the ported ./text module the file is the same too
      assert.deepEqual(spt, so, "port with the ported texts");
    });

    test(`import (${planName}, ${lang}): the port reads the file like the original`, async () => {
      const b = await build(planName, lang);
      const opts = { legs: LEGS, limits: b.plan.limits, keyOf: (ps, l) => O.state.structKeyOf(ps, l, b.plan.restBy[l], "none") };
      const file = new File([await b.p.arrayBuffer()], "transfer-plan.xlsx", { type: b.p.type });
      const oo = await O.excelImport.readPlanFromExcel(b.o, opts); // original file, original reader
      const op = await O.excelImport.readPlanFromExcel(file, opts); // ported file, original reader
      const po = await P.excelImport.readPlanFromExcel(b.o, opts); // original file, ported reader
      const pp = await P.excelImport.readPlanFromExcel(file, opts); // ported file, ported reader
      assert.deepEqual(op, oo);
      assert.deepEqual(po, oo);
      assert.deepEqual(pp, oo);
      // and it is the plan that was exported (a person without a place is written as "not joining", as in the original)
      const placed = (p, l) => Object.values(b.plan.layouts[l].layout.boxes).some((box) => box.includes(p.id));
      assert.deepEqual(pp.persons.map((p) => [p.name, p.car, p.seats, p.legs, p.team, p.lang, p.note]), b.plan.persons.map((p) => [p.name, p.car, p.seats, LEGS.map((_, l) => placed(p, l)), p.team, p.lang, p.note]));
      LEGS.forEach((_, l) => {
        const a = b.plan.layouts[l].layout;
        const r = pp.edits[l].layout;
        const names = (lay, list, id) => lay.boxes[id].map((pid) => (pid ? list.find((p) => p.id === pid).name : null));
        for (const kind of ["cars", "groups", "taxis"]) {
          const filled = a.order[kind].filter((id) => a.boxes[id].some(Boolean));
          assert.equal(r.order[kind].length, filled.length, `${kind} on leg ${l + 1}`);
          filled.forEach((id, i) => assert.deepEqual(names(r, pp.persons, r.order[kind][i]), names(a, b.plan.persons, id), `${kind} ${i + 1} on leg ${l + 1}`));
        }
        assert.equal(Object.keys(r.times).length, Object.keys(a.times).length, "own departure times");
      });
    });
  }
}

test("import: an edited sheet (Excel times, rich text, formulas, yes-words, full car) reads the same in both", async () => {
  const b = await build("demo", "de");
  const wb = new NodeExcelJS.Workbook();
  await wb.xlsx.load(await b.o.arrayBuffer());
  const ws = wb.getWorksheet(O.text.TEXT.de.xl.people);
  ws.getCell("I3").value = 0.625; // an Excel time: 15:00
  ws.getCell("I4").value = new Date(Date.UTC(2026, 10, 27, 9, 5));
  ws.getCell("A5").value = { richText: [{ text: "Rich " }, { text: "Text" }] };
  ws.getCell("B5").value = { formula: 'A1&"x"', result: "Team F" };
  ws.getCell("C5").value = "russisch";
  ws.getCell("D6").value = "ja";
  ws.getCell("E6").value = 9;
  ws.getCell("D7").value = "X";
  ws.getCell("E7").value = "3";
  ws.getCell("G8").value = "nicht dabei";
  ws.getCell("G9").value = "Taxi 7";
  ws.getCell("G10").value = "taxi 7";
  ws.getCell("K11").value = "Not joining";
  ws.getCell("G12").value = "";
  ws.getCell("A13").value = "";
  for (let r = 14; r <= 24; r++) ws.getCell(`G${r}`).value = "Auto 1"; // more riders than seats
  ws.getCell("G25").value = "Group 9";
  ws.getCell("H25").value = "Group ticket";
  ws.getCell("G26").value = "Группа 9";
  ws.getCell("G27").value = "Raumschiff 2";
  ws.getCell("A43").value = "Neu Dazu";
  const blob = new Blob([await wb.xlsx.writeBuffer()]);
  const opts = { legs: LEGS, limits: b.plan.limits, keyOf: (ps, l) => O.state.structKeyOf(ps, l, "tram", "none") };
  const o = await O.excelImport.readPlanFromExcel(blob, opts);
  const p = await P.excelImport.readPlanFromExcel(blob, opts);
  assert.deepEqual(p, o);
  assert.equal(p.persons.length, 40); // one name removed, one person added
  assert.equal(p.persons.at(-1).name, "Neu Dazu");
});

test("import: the errors are the same", async () => {
  const opts = { legs: LEGS, limits: { ...DEFAULT_LIMITS }, keyOf: () => "k" };
  const file = async (fill) => {
    const wb = new NodeExcelJS.Workbook();
    fill(wb);
    return new Blob([await wb.xlsx.writeBuffer()]);
  };
  const noSheet = await file((wb) => wb.addWorksheet("Tabelle1"));
  const noPersons = await file((wb) => (wb.addWorksheet(" PEOPLE ").getCell("A1").value = "Name"));
  for (const read of [O.excelImport.readPlanFromExcel, P.excelImport.readPlanFromExcel]) {
    await assert.rejects(read(noSheet, opts), { message: "no people sheet" });
    await assert.rejects(read(noPersons, opts), { message: "no persons" });
    await assert.rejects(read(new Blob(["not a zip"]), opts));
  }
});
