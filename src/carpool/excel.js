// Excel export of the plan: overview, one sheet per leg (a coloured block per vehicle), a check-in list per leg,
// the people with filters (this sheet can be edited and loaded back), a message for every person, a cost sheet, the hints.
// exceljs is loaded only when the export is used.
export const SYMBOLIC_PRICES = { ticket: 30, taxi: 15 }; // example values in EUR, to be adjusted in the sheet

const C = {
  dark: "FF111111",
  white: "FFFFFFFF",
  grey: "FFE5E7EB",
  greyL: "FFF4F5F7",
  line: "FFD5D9E0",
  car: "FFC2B6EF",
  carL: "FFF0ECFB",
  tram: "FFB3CBEF",
  tramL: "FFEEF4FC",
  taxi: "FFA6DEC0",
  taxiL: "FFEAF7F0",
  warn: "FFF4A5A0",
  input: "FFFFF3C4",
};
const KIND = { car: [C.car, C.carL], tram: [C.tram, C.tramL], taxi: [C.taxi, C.taxiL] };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const edge = { style: "thin", color: { argb: C.line } };
const box = { top: edge, left: edge, bottom: edge, right: edge };
const EURO = '#,##0.00 "€"';

function styleCell(cell, o = {}) {
  if (o.fill) cell.fill = fill(o.fill);
  cell.font = { name: "Calibri", size: o.size || 11, bold: !!o.bold, color: { argb: o.color || "FF111111" } };
  cell.alignment = { vertical: "middle", horizontal: o.align || "left", wrapText: !!o.wrap, indent: o.indent || 0 };
  if (o.border !== false) cell.border = box;
  if (o.numFmt) cell.numFmt = o.numFmt;
}

// a full-width coloured band (title / vehicle header)
function band(ws, rowNo, cols, text, bg, o = {}) {
  ws.mergeCells(rowNo, 1, rowNo, cols);
  const cell = ws.getCell(rowNo, 1);
  cell.value = text;
  styleCell(cell, { fill: bg, bold: true, size: o.size || 12, color: o.color, border: false, indent: 1 });
  ws.getRow(rowNo).height = o.height || 24;
}

// dark header row of a table
function header(ws, rowNo, labels) {
  labels.forEach((l, i) => {
    const c = ws.getCell(rowNo, i + 1);
    c.value = l;
    styleCell(c, { fill: C.dark, bold: true, color: C.white });
  });
  ws.getRow(rowNo).height = 22;
}

// A4 landscape, one page wide, the title band repeats on every page
function printSetup(ws) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
}

const first = (name) => String(name || "").split(" ")[0];
const joinList = (arr, lang) => (arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} ${lang === "de" ? "und" : "and"} ${arr[arr.length - 1]}`);

// the text for one person on one leg, ready to copy into a mail or chat
function personMessage({ p, l, lg, lay, byId, lang, t, time }) {
  const de = lang === "de";
  const where = (() => {
    for (const [n, id] of lay.order.cars.entries()) {
      const i = lay.boxes[id].indexOf(p.id);
      if (i !== -1) return { kind: "car", id, n: n + 1, slots: lay.boxes[id], driver: i === 0 };
    }
    for (const [n, id] of lay.order.groups.entries()) if (lay.boxes[id].includes(p.id)) return { kind: "tram", id, n: n + 1, slots: lay.boxes[id] };
    for (const [n, id] of lay.order.taxis.entries()) if (lay.boxes[id].includes(p.id)) return { kind: "taxi", id, n: n + 1, slots: lay.boxes[id] };
    return null;
  })();
  if (!where) return de ? `Für ${t.leg} ${l + 1} bist du nicht eingeplant.` : `You are not planned for ${t.leg} ${l + 1}.`;
  const others = where.slots.filter((x) => x && x !== p.id).map((x) => byId[x].name);
  const from = lg.from.name[lang];
  const to = lg.to.name[lang];
  const when = de ? `Abfahrt: ${time} Uhr ab ${from} nach ${to}.` : `Departure: ${time} from ${from} to ${to}.`;
  const hi = de ? `Hallo ${first(p.name)}, bei ${t.leg} ${l + 1} ` : `Hello ${first(p.name)}, on ${t.leg} ${l + 1} `;
  if (where.kind === "car") {
    if (where.driver)
      return de
        ? `${hi}fährst du im Auto ${where.n} als Fahrer:in. ${others.length ? `Deine Mitfahrer:innen: ${joinList(others, lang)}.` : "Du fährst allein."} ${when}`
        : `${hi}you drive car ${where.n}. ${others.length ? `Your passengers: ${joinList(others, lang)}.` : "You drive alone."} ${when}`;
    const driver = byId[where.slots[0]].name;
    const rest = others.filter((n) => n !== driver);
    return de
      ? `${hi}fährst du im Auto ${where.n} mit ${driver} (Fahrer:in)${rest.length ? ` und ${joinList(rest, lang)}` : ""}. ${when}`
      : `${hi}you ride in car ${where.n} with ${driver} (driver)${rest.length ? ` and ${joinList(rest, lang)}` : ""}. ${when}`;
  }
  if (where.kind === "tram") {
    const buyerId = lay.buyers[where.id];
    if (buyerId === p.id)
      return de
        ? `${hi}fährst du in Gruppe ${where.n} mit Bahn und Tram. Du kaufst das Gruppenticket${others.length ? ` für ${joinList(others, lang)}` : ""}. ${when}`
        : `${hi}you travel in group ${where.n} by public transport. You buy the group ticket${others.length ? ` for ${joinList(others, lang)}` : ""}. ${when}`;
    const buyer = byId[buyerId]?.name;
    return de
      ? `${hi}fährst du in Gruppe ${where.n} mit Bahn und Tram${others.length ? ` zusammen mit ${joinList(others, lang)}` : ""}. ${buyer} kauft das Gruppenticket. ${when}`
      : `${hi}you travel in group ${where.n} by public transport${others.length ? ` together with ${joinList(others, lang)}` : ""}. ${buyer} buys the group ticket. ${when}`;
  }
  return de
    ? `${hi}fährst du im Taxi ${where.n}${others.length ? ` mit ${joinList(others, lang)}` : ""}. ${when}`
    : `${hi}you take taxi ${where.n}${others.length ? ` with ${joinList(others, lang)}` : ""}. ${when}`;
}

export async function buildWorkbook({ persons, layouts, legs, lang, t, checks, date }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "alseda";
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true }; // Excel recalculates the cost formulas when the file is opened
  const H = t.csvHead; // Leg, Time, From, To, Name, Transport, Group, Role, Team, Language
  const byId = Object.fromEntries(persons.map((p) => [p.id, p]));
  const routeOf = (lg) => `${lg.from.name[lang]} → ${lg.to.name[lang]}`;
  const timeOf = (lay, id, lg) => (lay.times && lay.times[id]) || lg.time;
  const counts = (lay) => {
    const n = (ids) => ids.reduce((s, id) => s + lay.boxes[id].filter(Boolean).length, 0);
    return { car: n(lay.order.cars), tram: n(lay.order.groups), taxi: n(lay.order.taxis) };
  };
  const filledBoxes = (lay, kind) => lay.order[kind].filter((id) => lay.boxes[id].some(Boolean)).length;

  // ---------- overview ----------
  const ov = wb.addWorksheet(t.xl.overview, { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 12 }, { width: 10 }, { width: 28 }, { width: 28 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 14 }, { width: 12 }];
  band(ov, 1, 10, `${t.xl.title} · ${date}`, C.dark, { size: 16, color: C.white, height: 34 });
  const oh = [H[0], H[1], H[2], H[3], t.persons, t.car, "Tram", t.taxi, t.notThere, t.checksH];
  oh.forEach((l, i) => {
    const c = ov.getCell(3, i + 1);
    c.value = l;
    styleCell(c, { fill: i === 5 ? C.car : i === 6 ? C.tram : i === 7 ? C.taxi : i === 8 ? C.grey : C.dark, bold: true, color: i >= 5 && i <= 8 ? undefined : C.white, align: i >= 4 ? "center" : "left" });
  });
  ov.getRow(3).height = 22;
  legs.forEach((lg, l) => {
    const lay = layouts[l].layout;
    const n = counts(lay);
    const away = persons.filter((p) => !p.legs[l]).length;
    const hints = checks.filter((c) => c.leg === l).length;
    const vals = [`${t.leg} ${l + 1}`, lg.time, lg.from.name[lang], lg.to.name[lang], n.car + n.tram + n.taxi, n.car, n.tram, n.taxi, away, hints];
    vals.forEach((v, i) => {
      const c = ov.getCell(4 + l, i + 1);
      c.value = v;
      styleCell(c, { fill: i === 5 ? C.carL : i === 6 ? C.tramL : i === 7 ? C.taxiL : i === 8 ? C.greyL : undefined, align: i >= 4 ? "center" : "left", bold: i === 0 || i === 4 });
    });
    ov.getRow(4 + l).height = 22;
  });

  // ---------- one sheet per leg, and one check-in list per leg (same blocks, plus a tick column) ----------
  const legSheet = (l, withCheck) => {
    const lg = legs[l];
    const lay = layouts[l].layout;
    const ws = wb.addWorksheet(withCheck ? `${t.xl.check} ${l + 1}` : `${t.leg} ${l + 1}`, { views: [{ showGridLines: false }] });
    const cols = withCheck ? 6 : 5;
    ws.columns = withCheck ? [{ width: 28 }, { width: 18 }, { width: 22 }, { width: 11 }, { width: 26 }, { width: 14 }] : [{ width: 20 }, { width: 28 }, { width: 22 }, { width: 12 }, { width: 26 }];
    band(ws, 1, cols, `${withCheck ? `${t.xl.check} · ` : ""}${t.leg} ${l + 1} · ${lg.time} ${t.oclock}  ·  ${routeOf(lg)}`, C.dark, { size: 14, color: C.white, height: 32 });
    let r = 3;
    const block = (kind, title, rows) => {
      const [strong, light] = KIND[kind] || [C.grey, C.greyL];
      band(ws, r++, cols, title, strong);
      header(ws, r++, withCheck ? [H[4], H[7], H[8], H[9], t.noteCol, t.xl.checkCol] : [H[7], H[4], H[8], H[9], t.noteCol]);
      rows.forEach(([role, pid]) => {
        const p = byId[pid];
        const vals = withCheck ? [p.name, role, p.team, p.lang, p.note, "☐"] : [role, p.name, p.team, p.lang, p.note];
        vals.forEach((v, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = v || "";
          const isName = withCheck ? i === 0 : i === 1;
          const isRole = withCheck ? i === 1 : i === 0;
          styleCell(c, {
            fill: light,
            bold: isRole && !!role,
            align: (withCheck && i === 5) || i === 3 ? "center" : "left",
            indent: isName ? 1 : 0,
            size: withCheck && i === 5 ? 16 : 11,
          });
        });
        ws.getRow(r).height = withCheck ? 24 : 20;
        r++;
      });
      r++; // empty line between blocks
    };
    lay.order.cars.forEach((id, n) => {
      const slots = lay.boxes[id];
      block("car", `${t.car} ${n + 1}  ·  ${t.departAt} ${timeOf(lay, id, lg)}  ·  ${slots.filter(Boolean).length}/${slots.length}`, slots.map((pid, i) => pid && [i === 0 ? t.driver : "", pid]).filter(Boolean));
    });
    lay.order.groups.forEach((id, n) => {
      const slots = lay.boxes[id].filter(Boolean);
      if (slots.length)
        block("tram", `${t.group} ${n + 1}  ·  ${t.departAt} ${timeOf(lay, id, lg)}  ·  ${slots.length}/${lay.boxes[id].length}  ·  ${t.buyer}: ${byId[lay.buyers[id]]?.name || ""}`, slots.map((pid) => [lay.buyers[id] === pid ? t.buyer : "", pid]));
    });
    lay.order.taxis.forEach((id, n) => {
      const slots = lay.boxes[id].filter(Boolean);
      if (slots.length) block("taxi", `${t.taxi} ${n + 1}  ·  ${t.departAt} ${timeOf(lay, id, lg)}  ·  ${slots.length}/${lay.boxes[id].length}`, slots.map((pid) => ["", pid]));
    });
    const away = persons.filter((p) => !p.legs[l]);
    if (away.length) block("away", `${t.notThere}  ·  ${away.length}`, away.map((p) => ["", p.id]));
    printSetup(ws);
  };
  legs.forEach((_, l) => legSheet(l, false));
  legs.forEach((_, l) => legSheet(l, true));

  // ---------- people: one row per person across both legs (editable, can be loaded back) ----------
  const ps = wb.addWorksheet(t.xl.people, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  const cols = [t.name, t.team, t.langCol, t.mode, t.seatsOf];
  legs.forEach((_, l) => cols.push(`${t.leg} ${l + 1}`, `${t.assign} ${l + 1}`, `${H[7]} ${l + 1}`, `${t.departAt} ${l + 1}`));
  cols.push(t.noteCol);
  ps.columns = [{ width: 26 }, { width: 18 }, { width: 11 }, { width: 8 }, { width: 9 }, ...legs.flatMap(() => [{ width: 9 }, { width: 16 }, { width: 14 }, { width: 11 }]), { width: 28 }];
  header(ps, 1, cols);
  const where = layouts.map(({ layout: lay }, l) => {
    const m = {};
    lay.order.cars.forEach((id, n) => lay.boxes[id].forEach((pid, i) => pid && (m[pid] = { kind: "car", label: `${t.car} ${n + 1}`, role: i === 0 ? t.driver : "", time: timeOf(lay, id, legs[l]) })));
    lay.order.groups.forEach((id, n) => lay.boxes[id].forEach((pid) => pid && (m[pid] = { kind: "tram", label: `${t.group} ${n + 1}`, role: lay.buyers[id] === pid ? t.buyer : "", time: timeOf(lay, id, legs[l]) })));
    lay.order.taxis.forEach((id, n) => lay.boxes[id].forEach((pid) => pid && (m[pid] = { kind: "taxi", label: `${t.taxi} ${n + 1}`, role: "", time: timeOf(lay, id, legs[l]) })));
    return m;
  });
  persons.forEach((p, i) => {
    const row = i + 2;
    const vals = [p.name, p.team, p.lang, p.car ? "✓" : "", p.car ? p.seats : ""];
    legs.forEach((lg, l) => {
      const w = where[l][p.id];
      vals.push(p.legs[l] ? lg.time : "–", w ? w.label : t.notThere, w ? w.role : "", w ? w.time : "");
    });
    vals.push(p.note || "");
    vals.forEach((v, j) => {
      const c = ps.getCell(row, j + 1);
      c.value = v;
      const inLegs = j >= 5 && j < 5 + 4 * legs.length;
      const legIdx = inLegs ? Math.floor((j - 5) / 4) : -1;
      const w = legIdx >= 0 ? where[legIdx][p.id] : null;
      const slot = inLegs ? (j - 5) % 4 : -1; // 0 leg time, 1 assignment, 2 role, 3 departure; the last column is the note
      styleCell(c, {
        fill: slot === 1 ? (w ? KIND[w.kind][1] : C.greyL) : i % 2 ? C.greyL : undefined,
        align: j === 0 || j === 1 || slot === 2 || j === 5 + 4 * legs.length ? "left" : "center",
        bold: slot === 1 && !!w,
      });
    });
    ps.getRow(row).height = 20;
  });
  ps.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  // ---------- messages: one ready text per person and leg ----------
  const ms = wb.addWorksheet(t.xl.messages, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ms.columns = [{ width: 24 }, ...legs.map(() => ({ width: 78 }))];
  header(ms, 1, [t.name, ...legs.map((_, l) => `${t.leg} ${l + 1}`)]);
  persons.forEach((p, i) => {
    const row = i + 2;
    const c0 = ms.getCell(row, 1);
    c0.value = p.name;
    styleCell(c0, { bold: true, fill: i % 2 ? C.greyL : undefined });
    legs.forEach((lg, l) => {
      const lay = layouts[l].layout;
      const w = where[l][p.id];
      const c = ms.getCell(row, l + 2);
      c.value = personMessage({ p, l, lg, lay, byId, lang, t, time: w ? w.time : lg.time });
      styleCell(c, { wrap: true, fill: w ? KIND[w.kind][1] : C.greyL });
    });
    ms.getRow(row).height = 48;
  });

  // ---------- costs: symbolic prices in the yellow cells, the sums are real formulas ----------
  const cs = wb.addWorksheet(t.xl.costs, { views: [{ showGridLines: false }] });
  cs.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }];
  band(cs, 1, 6, t.xl.costs, C.dark, { size: 16, color: C.white, height: 34 });
  const price = (rowNo, label, value) => {
    const a = cs.getCell(rowNo, 1);
    a.value = label;
    styleCell(a, { bold: true, fill: C.greyL });
    const b = cs.getCell(rowNo, 2);
    b.value = value;
    styleCell(b, { fill: C.input, bold: true, align: "center", numFmt: EURO });
  };
  price(3, t.xl.ticketPrice, SYMBOLIC_PRICES.ticket);
  price(4, t.xl.taxiPrice, SYMBOLIC_PRICES.taxi);
  cs.mergeCells(5, 1, 5, 6);
  const note = cs.getCell(5, 1);
  note.value = t.xl.adjust;
  styleCell(note, { border: false, color: "FF6B7280", size: 10 });
  header(cs, 7, [H[0], t.xl.tickets, t.xl.rides, t.xl.ticketCost, t.xl.taxiCost, t.xl.total]);
  const last = 7 + legs.length;
  legs.forEach((lg, l) => {
    const r = 8 + l - 0;
    const lay = layouts[l].layout;
    const tickets = filledBoxes(lay, "groups");
    const rides = filledBoxes(lay, "taxis");
    const vals = [
      `${t.leg} ${l + 1} · ${lg.time}`,
      tickets,
      rides,
      { formula: `B${r}*$B$3`, result: tickets * SYMBOLIC_PRICES.ticket },
      { formula: `C${r}*$B$4`, result: rides * SYMBOLIC_PRICES.taxi },
      { formula: `D${r}+E${r}`, result: tickets * SYMBOLIC_PRICES.ticket + rides * SYMBOLIC_PRICES.taxi },
    ];
    vals.forEach((v, i) => {
      const c = cs.getCell(r, i + 1);
      c.value = v;
      styleCell(c, { align: i === 0 ? "left" : "center", numFmt: i >= 3 ? EURO : undefined, fill: i === 1 || i === 3 ? C.tramL : i === 2 || i === 4 ? C.taxiL : undefined, bold: i === 5 });
    });
    cs.getRow(r).height = 22;
  });
  const totalRow = last + 1;
  const sum = (col) => ({ formula: `SUM(${col}8:${col}${last})`, result: 0 });
  const totals = [t.xl.sum, sum("B"), sum("C"), sum("D"), sum("E"), sum("F")];
  // cached results so that viewers without a calculation engine show numbers too
  const cached = legs.map((_, l) => {
    const lay = layouts[l].layout;
    const tk = filledBoxes(lay, "groups");
    const rd = filledBoxes(lay, "taxis");
    return [tk, rd, tk * SYMBOLIC_PRICES.ticket, rd * SYMBOLIC_PRICES.taxi, tk * SYMBOLIC_PRICES.ticket + rd * SYMBOLIC_PRICES.taxi];
  });
  totals.forEach((v, i) => {
    if (i > 0) v.result = cached.reduce((s, row) => s + row[i - 1], 0);
    const c = cs.getCell(totalRow, i + 1);
    c.value = v;
    styleCell(c, { fill: C.dark, color: C.white, bold: true, align: i === 0 ? "left" : "center", numFmt: i >= 3 ? EURO : undefined });
  });
  cs.getRow(totalRow).height = 24;

  // ---------- hints ----------
  if (checks.length) {
    const hs = wb.addWorksheet(t.checksH, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    hs.columns = [{ width: 12 }, { width: 14 }, { width: 90 }];
    header(hs, 1, [H[0], t.xl.level, t.checksH]);
    checks.forEach((c, i) => {
      const row = i + 2;
      [`${t.leg} ${c.leg + 1}`, c.level === "warn" ? t.levelWarn : t.levelInfo, t.chk[c.code](c.args, t.kinds)].forEach((v, j) => {
        const cell = hs.getCell(row, j + 1);
        cell.value = v;
        styleCell(cell, { fill: j === 1 ? (c.level === "warn" ? C.warn : C.grey) : undefined, bold: j === 1, wrap: j === 2, align: j === 2 ? "left" : "center" });
      });
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
