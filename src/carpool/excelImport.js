// Reads an exported (and maybe edited) plan back from Excel: the "Personen" / "People" sheet holds one row per person.
// columns: name, team, language, car, seats, then for every leg: leg time, assignment ("Auto 2", "Gruppe 1", "Taxi 3" or "nicht dabei"),
// role (driver / group ticket) and the departure time of the vehicle.
import { CAR_SEATS, MIN_SEATS, normLang } from "./planner.js";

const SHEETS = ["personen", "people"];
const AWAY = ["nicht dabei", "not joining", "–", "-"];
const KINDS = { auto: "car", car: "car", gruppe: "group", group: "group", taxi: "taxi" };
const DRIVER = ["fahrer:in", "driver"];
const BUYER = ["gruppenticket", "group ticket"];
const YES = ["✓", "x", "ja", "yes", "1", "true", "wahr", "evet"];

const text = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return "";
    if (v.richText) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v) return text(v.result);
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
};

// "14:50", an Excel time (fraction of a day) or a date value -> "14:50"
function clock(v) {
  const two = (n) => String(n).padStart(2, "0");
  if (v instanceof Date) return `${two(v.getUTCHours())}:${two(v.getUTCMinutes())}`;
  if (typeof v === "number" && v >= 0 && v < 1) {
    const m = Math.round(v * 1440);
    return `${two(Math.floor(m / 60) % 24)}:${two(m % 60)}`;
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(text(v));
  return m ? `${two(+m[1])}:${m[2]}` : "";
}

const pad = (list, n) => {
  const a = list.slice(0, n);
  while (a.length < n) a.push(null);
  return a;
};

// -> { persons, edits }  (edits: { [leg]: { key, layout } })
export async function readPlanFromExcel(file, { legs, limits, keyOf }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets.find((s) => SHEETS.includes(s.name.trim().toLowerCase()));
  if (!ws) throw new Error("no people sheet");

  const persons = [];
  const rows = []; // the raw cells of every person, per leg: { label, role, depart }
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const name = text(row.getCell(1).value);
    if (!name) return;
    const car = YES.includes(text(row.getCell(4).value).toLowerCase());
    const seats = Math.min(CAR_SEATS, Math.max(MIN_SEATS, parseInt(text(row.getCell(5).value), 10) || CAR_SEATS));
    const cells = legs.map((_, l) => {
      const base = 6 + l * 4;
      return { label: text(row.getCell(base + 1).value), role: text(row.getCell(base + 2).value).toLowerCase(), depart: clock(row.getCell(base + 3).value) };
    });
    persons.push({
      id: `X${String(persons.length + 1).padStart(3, "0")}`,
      name,
      car,
      seats,
      legs: cells.map((c) => !AWAY.includes(c.label.toLowerCase())), // an empty assignment still means "joins"
      team: text(row.getCell(2).value),
      lang: normLang(text(row.getCell(3).value)),
      note: text(row.getCell(6 + legs.length * 4).value), // the note is the last column
    });
    rows.push(cells);
  });
  if (!persons.length) throw new Error("no persons");

  const edits = {};
  legs.forEach((lg, l) => {
    const labelOf = (i) => {
      const m = /^([^\d]+?)\s*(\d+)$/.exec(rows[i][l].label);
      const kind = m && KINDS[m[1].trim().toLowerCase()];
      return kind ? { kind, n: +m[2] } : null;
    };
    const boxes = {};
    const order = { cars: [], groups: [], taxis: [] };
    const buyers = {};
    const times = {};
    const depart = (id, i) => {
      const d = rows[i][l].depart;
      if (d && d !== lg.time && !times[id]) times[id] = d;
    };

    // every driver on this leg gets a car; riders go to the car whose number they carry
    const carByNumber = {};
    persons.forEach((p, i) => {
      if (!p.car || !p.legs[l]) return;
      const id = `c${order.cars.length + 1}`;
      order.cars.push(id);
      boxes[id] = pad([p.id], p.seats);
      const lab = labelOf(i);
      if (lab && lab.kind === "car") carByNumber[lab.n] = id;
      depart(id, i);
    });
    // groups and taxis in the order of their numbers
    const make = (kind, prefix, key, size) => {
      const nums = [...new Set(persons.map((p, i) => (p.legs[l] && !p.car && labelOf(i)?.kind === kind ? labelOf(i).n : null)).filter((n) => n !== null))].sort((a, b) => a - b);
      const ids = {};
      nums.forEach((n, k) => {
        const id = `${prefix}${k + 1}`;
        ids[n] = id;
        order[key].push(id);
        boxes[id] = Array(size).fill(null);
      });
      return ids;
    };
    const groupIds = make("group", "g", "groups", limits.groupMax);
    const taxiIds = make("taxi", "t", "taxis", limits.taxiSeats);

    persons.forEach((p, i) => {
      if (!p.legs[l] || p.car) return;
      const lab = labelOf(i);
      if (!lab) return; // no assignment: the app places this person
      const id = lab.kind === "car" ? carByNumber[lab.n] : lab.kind === "group" ? groupIds[lab.n] : taxiIds[lab.n];
      if (!id) return;
      const free = boxes[id].findIndex((x, k) => x === null && !(id[0] === "c" && k === 0));
      if (free === -1) return; // the vehicle is full: the app places this person elsewhere
      boxes[id][free] = p.id;
      if (lab.kind === "group" && BUYER.includes(rows[i][l].role)) buyers[id] = p.id;
      depart(id, i);
    });
    edits[l] = { key: keyOf(persons, l), layout: { boxes, order, buyers, times } };
  });
  return { persons, edits };
}
