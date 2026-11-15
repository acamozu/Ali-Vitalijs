// End-to-end test in a real (headless) Chrome: clicks through every function of the page.
// Needs the dev server (npm run dev) and Chrome. Run: node tests/e2e.mjs   (CHROME=... URL=... to override)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ExcelJS from "exceljs";
import { defaultPersons as defaultPersons40 } from "../src/carpool/planner.js";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = (process.env.URL || "http://localhost:5173/carpool.html") + "?nosplash"; // the loading splash would cover the page
const PORT = 9560 + Math.floor(Math.random() * 100);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "carpool-e2e-"));

// ---------- tiny test harness ----------
const results = { pass: 0, fail: 0, failures: [] };
let section = "";
const check = (name, cond, detail = "") => {
  if (cond) results.pass++;
  else {
    results.fail++;
    results.failures.push(`[${section}] ${name}${detail ? " — " + detail : ""}`);
  }
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
};
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- browser ----------
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(TMP, "profile")}`, "about:blank"], { stdio: "ignore" });
await wait(2500);
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = {};
const pageErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) {
    pending[m.id](m.result);
    delete pending[m.id];
  }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value || a.description).join(" ").slice(0, 300));
};
const send = (method, params = {}) => new Promise((r) => { pending[++nextId] = r; ws.send(JSON.stringify({ id: nextId, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
const evp = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await send("Runtime.enable");
await send("DOM.enable");
await send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: new globalThis.URL(URL_).origin }).catch(() => {});

const $ = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
const $$ = (sel) => `document.querySelectorAll(${JSON.stringify(sel)})`;
const count = (sel) => ev(`${$$(sel)}.length`);
const text = (sel) => ev(`${$(sel)}?.textContent.trim()`);
const exists = async (sel) => (await count(sel)) > 0;
const nth = (sel, i) => `${$$(sel)}[${i}]`;
const byText = (sel, t) => `[...${$$(sel)}].find(e => e.textContent.trim() === ${JSON.stringify(t)})`;
const startsWith = (sel, t) => `[...${$$(sel)}].find(e => e.textContent.trim().startsWith(${JSON.stringify(t)}))`;

async function viewport(w, h, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
}
async function fresh(w = 1440, h = 900, mobile = false, seed = null) {
  await viewport(w, h, mobile);
  await send("Page.navigate", { url: URL_ });
  await wait(1700);
  await ev("localStorage.clear()");
  if (seed) await ev(`localStorage.setItem('carpool-v3', ${JSON.stringify(JSON.stringify(seed))})`);
  await send("Page.reload");
  await wait(1700);
  await hooks();
}
// confirm / alert / download hooks
async function hooks() {
  await ev(`(() => {
    window.confirm = () => true; window.__alerts = []; window.alert = (m) => window.__alerts.push(m);
    window.__blobs = []; window.__names = [];
    const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); };
    HTMLAnchorElement.prototype.click = function () { window.__names.push(this.download); };
  })()`);
}
const reload = async () => { await send("Page.reload"); await wait(1700); await hooks(); };
const state = async () => JSON.parse((await ev("localStorage.getItem('carpool-v3')")) || "null");
const setState = async (fn) => { const s = await state(); fn(s); await ev(`localStorage.setItem('carpool-v3', ${JSON.stringify(JSON.stringify(s))})`); await reload(); };

async function center(expr) {
  await ev(`(${expr}).scrollIntoView({block:'center',behavior:'instant'})`);
  await wait(120);
  return JSON.parse(await ev(`(() => { const r = (${expr}).getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`));
}
async function click(expr, pause = 250) {
  const a = await center(expr);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: a.x, y: a.y, button: "left", buttons: 0, clickCount: 1 });
  await wait(pause);
}
const clickSel = (sel, i = 0, pause) => click(nth(sel, i), pause);
async function drag(fromExpr, toExpr) {
  const a = await center(fromExpr);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", buttons: 1, clickCount: 1 });
  const b = await center(toExpr);
  for (let i = 1; i <= 8; i++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8, buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", buttons: 0, clickCount: 1 });
  await wait(300);
}
async function key(k, code, vk, mod = 0) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  await wait(200);
}
const enter = () => key("Enter", "Enter", 13);
const escape = () => key("Escape", "Escape", 27);
async function typeInto(expr, txt) {
  await click(expr, 120);
  await ev(`(${expr}).select && (${expr}).select()`);
  await send("Input.insertText", { text: txt });
  await enter();
}
// pick an entry of a Base UI dropdown
async function choose(triggerExpr, label) {
  await click(triggerExpr, 350);
  const ok = await ev(`(() => { const p = [...document.querySelectorAll('.select__popup')].filter(x => x.getBoundingClientRect().height > 0).pop(); return !!p && [...p.querySelectorAll('.select__item')].some(i => i.textContent.trim() === ${JSON.stringify(label)}); })()`);
  if (!ok) return false;
  await click(`[...[...document.querySelectorAll('.select__popup')].filter(x => x.getBoundingClientRect().height > 0).pop().querySelectorAll('.select__item')].find(i => i.textContent.trim() === ${JSON.stringify(label)})`, 350);
  return true;
}
const menuItems = () => ev(`(() => { const p = [...document.querySelectorAll('.select__popup')].filter(x => x.getBoundingClientRect().height > 0).pop(); return p ? [...p.querySelectorAll('.select__item')].map(i => i.textContent.trim()) : []; })()`);
async function setFile(sel, file) {
  await ev(`${$(sel)}.setAttribute('data-e2e','1')`);
  const root = (await send("DOM.getDocument")).root.nodeId;
  const { nodeId } = await send("DOM.querySelector", { nodeId: root, selector: "[data-e2e='1']" });
  await send("DOM.setFileInputFiles", { files: [file], nodeId });
  await ev(`${$(sel)}.removeAttribute('data-e2e')`);
  await wait(2200);
}
// the last blob that the page created (download), as text or as a file in TMP
async function lastBlobText() {
  return evp(`new Promise(res => { const b = window.__blobs[window.__blobs.length - 1]; if (!b) return res(null); const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(b); })`);
}
async function lastBlobFile(name) {
  const b64 = await evp(`new Promise(res => { const b = window.__blobs[window.__blobs.length - 1]; if (!b) return res(null); const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); })`);
  if (!b64) return null;
  const file = path.join(TMP, name);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  return file;
}

// frequently used readers
const counts = async () => (await ev(`[...${$$(".count strong")}].map(e => +e.textContent)`));
const assignment = async () => JSON.parse(await ev(`JSON.stringify(Object.fromEntries([...${$$(".tbl tbody tr")}].map(r => [r.children[1].textContent, r.querySelector('.pill')?.textContent])))`));
const peopleTitle = () => text("#all .tile-title");
const legBtn = (n) => `[...${$$(".bar-leg .pill-field > .seg button")}][${n - 1}]`;
const restBtn = (name) => byText(".bar-leg .field-group .seg button", name);
const groupBtn = (name) => byText(".bar-plan .field-group .seg button", name);
const countBtn = (mode, plus) => nth(".count-ctl button", { car: 0, tram: 2, taxi: 4 }[mode] + (plus ? 1 : 0));
const groupsBox = (i) => nth("#tram .stepper.small", i);
const SEATS = (id) => `${$(`[data-seat="${id}"]`)}`;
const flat = (s) => (typeof s === "string" ? s.replace(/\s+/g, "") : s);
const seatName = async (id) => flat(await ev(`${$(`[data-seat="${id}"] .seat-name`)}?.textContent || ${$(`[data-seat="${id}"] .pp-name`)}?.textContent || null`));
const slotName = async (id) => flat(await ev(`${$(`[data-seat="${id}"] .pp-name`)}?.textContent || ${$(`[data-seat="${id}"] .seat-name`)}?.textContent || null`));
const slotOf = (id) => `${$(`[data-seat="${id}"]`)}`;

async function run(name, fn) {
  if (process.env.ONLY && !process.env.ONLY.split(',').some((p) => name.startsWith(p + ' '))) return;
  section = name;
  console.log(`\n■ ${name}`);
  try {
    await fn();
  } catch (e) {
    check("section ran without an exception", false, String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
  }
}
const DEFAULT_NAMES = { P01: "AlexBeispiel", P05: "EliBeispiel" };

// =====================================================================================================
await run("1 · start page", async () => {
  await fresh();
  check("title is shown", /Transfers/.test(await text("h1")), await text("h1"));
  eq("counts car / tram / taxi", await counts(), [20, 20, 0]);
  eq("people title", await peopleTitle(), "Personen (40)");
  check("hero shows 40 people", (await text(".holo-facts")).includes("40"));
  eq("cars / tram groups / taxis drawn", [await count("#cars .pcard"), await count("#tram .pcard"), await count("#taxi .pcard")], [4, 4, 0]);
  eq("section titles carry the numbers", [await text("#cars .tile-title"), await text("#tram .tile-title"), await text("#taxi .tile-title")], ["Fahrgemeinschaften (20)", "ÖPNV (20)", "Taxi (0)"]);
  check("hints are all fine", (await text(".check.ok")).includes("Alles in Ordnung"));
  eq("hint badge is 0", await text(".warn-badge"), "0");
  check("language codes are written on seats", (await count(".lang-tag")) >= 40);
  check("the two notes show an info mark", (await count(".note-flag")) === 2);
  check("no horizontal scrolling", !(await ev("document.documentElement.scrollWidth > innerWidth")));
});

await run("2 · language DE / EN", async () => {
  await clickSel(".cp-lang button", 1);
  eq("html lang", await ev("document.documentElement.lang"), "en");
  eq("English headings", [await text("#checks .tile-title"), await text("#cars .tile-title"), await text("#tram .tile-title")], ["Checks", "Carpools (20)", "Public Transport (20)"]);
  await reload();
  eq("language is remembered after reload", await ev("document.documentElement.lang"), "en");
  await clickSel(".cp-lang button", 0);
  eq("back to German", await text("#checks .tile-title"), "Hinweise");
});

await run("3 · leg and rest mode", async () => {
  await fresh();
  await click(legBtn(2));
  check("leg 2 shown in the hero", (await text(".holo-label")).includes("18:00"), await text(".holo-label"));
  check("route of leg 2", (await text(".holo-venue")).includes("Casa Isoletta"));
  await click(legBtn(1));
  check("leg 1 again", (await text(".holo-label")).includes("15:00"));
  await click(restBtn("Taxi"));
  eq("rest by taxi: counts", await counts(), [20, 0, 20]);
  eq("rest by taxi: 5 taxis, no tram group", [await count("#taxi .pcard"), await count("#tram .pcard")], [5, 0]);
  await click(restBtn("Tram"));
  eq("rest by tram again", await counts(), [20, 20, 0]);
});

await run("4 · count tiles (+ / −)", async () => {
  await fresh();
  const disabled = () => ev(`[...${$$(".count-ctl button")}].map(b => b.disabled ? 1 : 0).join('')`);
  eq("buttons at start (car + / tram + / taxi − locked)", await disabled(), "010110");
  await click(countBtn("car", false)); await click(countBtn("car", false));
  eq("car −2: the rest travels by tram", await counts(), [18, 22, 0]);
  eq("cars keep their 4 drivers", await count("#cars .pcard"), 4);
  await click(countBtn("car", true));
  eq("car +1", await counts(), [19, 21, 0]);
  await click(countBtn("tram", false));
  eq("tram −1 goes to taxi", await counts(), [19, 20, 1]);
  await click(countBtn("taxi", true));
  eq("taxi +1 takes from tram", await counts(), [19, 19, 2]);
  check("sum stays 40", (await counts()).reduce((a, b) => a + b, 0) === 40);
  check("the taxi appears", (await count("#taxi .pcard")) >= 1);
  await click(countBtn("taxi", false)); await click(countBtn("taxi", false));
  eq("taxi back to 0", (await counts())[2], 0);
  // minimum of cars = number of drivers
  for (let i = 0; i < 20; i++) await click(countBtn("car", false), 60);
  eq("car count cannot go below the 4 drivers", (await counts())[0], 4);
  check("car − is locked at the minimum", await ev(`${nth(".count-ctl button", 0)}.disabled`));
});

await run("5 · tram groups and taxis", async () => {
  await fresh();
  const gv = async (i) => ev(`+${groupsBox(i)}.querySelector('strong').textContent`);
  eq("groups / max per group", [await gv(0), await gv(1)], [4, 5]);
  check("groups − is locked at the minimum (20 people / 5)", await ev(`${groupsBox(0)}.querySelectorAll('button')[0].disabled`));
  await click(`${groupsBox(0)}.querySelectorAll('button')[1]`);
  eq("5 groups after +", [await gv(0), await count("#tram .pcard")], [5, 5]);
  eq("20 people spread over the 5 groups (4 each)", await ev(`[...${$$("#tram .pcard .pcard-fill")}].map(e => e.textContent)`), ["4/5", "4/5", "4/5", "4/5", "4/5"]);
  await click(`${groupsBox(1)}.querySelectorAll('button')[0]`);
  eq("max per group 4 -> sizes follow", await ev(`[...${$$("#tram .pcard .pcard-fill")}].map(e => e.textContent)`), ["4/4", "4/4", "4/4", "4/4", "4/4"]);
  await click(`${groupsBox(1)}.querySelectorAll('button')[1]`);
  await click(`${groupsBox(0)}.querySelectorAll('button')[0]`);
  eq("back to 4 groups of 5", [await gv(0), await gv(1)], [4, 5]);
  // taxi seats: at most 4
  const tv = async () => ev(`+${nth("#taxi .stepper.small", 0)}.querySelector('strong').textContent`);
  eq("taxi seats default", await tv(), 4);
  check("taxi seats + is locked at 4", await ev(`${nth("#taxi .stepper.small", 0)}.querySelectorAll('button')[1].disabled`));
  await click(`${nth("#taxi .stepper.small", 0)}.querySelectorAll('button')[0]`);
  eq("taxi seats 3", await tv(), 3);
  await click(`${nth("#taxi .box-tools .ghost", 0)}`);
  eq("+ Taxi adds an empty taxi with 3 places", [await count("#taxi .pcard"), await text("#taxi .pcard .pcard-fill")], [1, "0/3"]);
  check("an empty taxi has a delete button", (await count("#taxi .pcard .pcard-head .icon-btn")) === 1);
  await click(nth("#taxi .pcard .pcard-head .icon-btn", 0));
  eq("empty taxi deleted", await count("#taxi .pcard"), 0);
  await click(`${nth("#taxi .stepper.small", 0)}.querySelectorAll('button')[1]`);
  eq("taxi seats back to 4", await tv(), 4);
});

await run("6 · moving people (tap, drag, drivers, buyer)", async () => {
  await fresh();
  const a = await seatName("c1:1"), b = await seatName("c2:1");
  await click(SEATS("c1:1"));
  check("tap selects a passenger", (await count(".is-picked")) === 1 && (await exists(".pick-bar")));
  await click(SEATS("c2:1"));
  eq("tap, tap swaps two passengers", [await seatName("c1:1"), await seatName("c2:1")], [b, a]);
  check("the selection is cleared", (await count(".is-picked")) === 0);
  const driver1 = nth("#cars .seat.driver", 0);
  await click(driver1);
  check("a driver cannot be selected", (await count(".is-picked")) === 0);
  check("a driver seat has no seat address (it is no target)", (await ev(`${driver1}.hasAttribute('data-seat')`)) === false);
  await click(SEATS("c1:1")); await click(driver1);
  check("a driver seat is no target either", flat(await ev(`${driver1}.querySelector('.seat-name').textContent`)) === DEFAULT_NAMES.P01 && (await seatName("c1:1")) === b);
  await escape();
  // drag between tram groups with the mouse
  const g1 = await slotName("g1:1"), g2 = await slotName("g2:1");
  await drag(slotOf("g1:1"), slotOf("g2:1"));
  eq("mouse drag swaps two tram members", [await slotName("g1:1"), await slotName("g2:1")], [g2, g1]);
  // car passenger -> tram group (swap with a member)
  const c3 = await seatName("c3:1"), t3 = await slotName("g3:2");
  await click(SEATS("c3:1")); await click(slotOf("g3:2"));
  eq("a car passenger and a tram member can swap", [await seatName("c3:1"), await slotName("g3:2")], [t3, c3]);
  // move into a free taxi place
  await click(nth("#taxi .box-tools .ghost", 0));
  const mover = await seatName("c4:1");
  await click(SEATS("c4:1")); await click(slotOf("t1:0"));
  eq("moved into the taxi (the seat in the car shows 'frei')", [await slotName("t1:0"), await seatName("c4:1")], [mover, "frei"]);
  eq("counts follow: 19 car, 1 taxi", [(await counts())[0], (await counts())[2]], [19, 1]);
  check("the car has a free seat now", (await text("#cars .pcard:nth-child(4) .pcard-fill")) === "4/5");
  // ticket buyer
  const buyerOf = () => ev(`${$("#tram .pcard:nth-child(1) .buy.on")}.closest('li').querySelector('.pp-name').textContent`);
  const first = await buyerOf();
  await click(`${nth("#tram .pcard:nth-child(1) .buy", 2)}`);
  const second = await buyerOf();
  check("clicking the ticket icon changes the buyer", first !== second, `${first} / ${second}`);
  eq("exactly one buyer per group", await count("#tram .pcard:nth-child(1) .buy.on"), 1);
  const bs = await slotName("g1:2");
  check("the new buyer is the clicked person", flat(second) === bs);
  // buyer moves out -> the first member becomes buyer
  await click(slotOf("g1:2")); await click(slotOf("g2:0"));
  check("a group still has exactly one buyer after the buyer left", (await count("#tram .pcard:nth-child(1) .buy.on")) === 1);
  // 24 h departure time
  const tf = nth("#cars .time-input", 1);
  eq("time field is text, starts at the leg time", [await ev(`${tf}.type`), await ev(`${tf}.value`)], ["text", "15:00"]);
  await typeInto(tf, "1450"); eq("1450 -> 14:50", await ev(`${tf}.value`), "14:50");
  await typeInto(tf, "930"); eq("930 -> 09:30", await ev(`${tf}.value`), "09:30");
  await typeInto(tf, "2575"); eq("invalid time keeps the old one", await ev(`${tf}.value`), "09:30");
  await typeInto(tf, "2359"); eq("2359 -> 23:59", await ev(`${tf}.value`), "23:59");
  await click(tf, 100); await key("Backspace", "Backspace", 8); await ev(`${tf}.select()`); await send("Input.insertText", { text: "" }); await key("Backspace", "Backspace", 8); await enter();
  eq("empty -> back to the leg time", await ev(`${tf}.value`), "15:00");
  await typeInto(nth("#tram .time-input", 0), "1445");
  await reload();
  eq("a manual time survives a reload", await ev(`${nth("#tram .time-input", 0)}.value`), "14:45");
  await click(legBtn(2));
  eq("leg 2 has its own times", await ev(`${nth("#tram .time-input", 0)}.value`), "18:00");
});

await run("7 · grouping by team / language", async () => {
  await fresh();
  await click(groupBtn("Team"));
  check("a note about mixed vehicles appears", (await ev(`[...${$$(".check-text")}].some(e => /nicht einheitlich \\(Team\\)/.test(e.textContent))`)));
  eq("counts unchanged", await counts(), [20, 20, 0]);
  await click(groupBtn("Sprache"));
  check("hint now mentions the language", (await ev(`[...${$$(".check-text")}].some(e => /\\(Sprache\\)/.test(e.textContent))`)));
  const before = (await state()).groupBy;
  eq("choice is saved", before, "lang");
  // with team grouping the tram groups hold more team mates than without
  const sameTeam = async () => ev(`(() => { const rows = [...${$$("#tram .pcard")}].map(c => [...c.querySelectorAll('.pp-name')].map(e => e.textContent)); const team = Object.fromEntries([...${$$(".tbl tbody tr")}].map(r => [r.children[1].textContent, r.querySelector('.select__trigger').textContent.trim()])); return rows.reduce((n, g) => { const t = g.map(x => team[x]); return n + t.filter((x, i) => t.indexOf(x) !== i).length; }, 0); })()`);
  await click(groupBtn("Ohne")); const none = await sameTeam();
  await click(groupBtn("Team")); const team = await sameTeam();
  check("team grouping puts team mates together", team > none, `${team} vs ${none}`);
  await click(groupBtn("Ohne"));
});

await run("8 · undo / redo", async () => {
  await fresh();
  const undo = nth(".bar-undo button", 0), redo = nth(".bar-undo button", 1);
  check("undo and redo are locked at the start", (await ev(`${undo}.disabled`)) && (await ev(`${redo}.disabled`)));
  await click(restBtn("Taxi"));
  check("undo is available after a change", !(await ev(`${undo}.disabled`)));
  await click(undo);
  eq("undo restores tram", await counts(), [20, 20, 0]);
  check("redo is available", !(await ev(`${redo}.disabled`)));
  await click(redo);
  eq("redo applies it again", await counts(), [20, 0, 20]);
  await click(undo);
  // keyboard
  await click(restBtn("Taxi"));
  await key("z", "KeyZ", 90, 2);
  eq("Ctrl+Z undoes", await counts(), [20, 20, 0]);
  await key("y", "KeyY", 89, 2);
  eq("Ctrl+Y redoes", await counts(), [20, 0, 20]);
  // several steps back
  await click(restBtn("Tram")); await click(groupBtn("Team")); await click(groupBtn("Sprache"));
  await click(undo); await click(undo); await click(undo);
  eq("three steps back", [(await state()).restBy, (await state()).groupBy], ["taxi", "none"]);
  // manual moves are undone too
  await click(restBtn("Tram"));
  const x = await seatName("c1:1");
  await click(SEATS("c1:1")); await click(SEATS("c2:1"));
  check("manual move happened", (await seatName("c1:1")) !== x);
  await click(undo);
  eq("undo reverts the manual move", await seatName("c1:1"), x);
});

await run("9 · save plan (JSON) and load plan", async () => {
  await fresh();
  await click(groupBtn("Team"));
  await click(nth(".bar-files .ghost", 0), 600);
  const json = await lastBlobText();
  const plan = JSON.parse(json);
  check("a plan file was created", plan.app === "carpool" && plan.version === 1);
  eq("file name", (await ev("window.__names")).pop(), `transfer-plan-2026-11-27.xlsx`.replace("transfer-plan", "carpool-plan").replace(".xlsx", ".json"));
  eq("file holds the roster and the grouping", [plan.doc.persons.length, plan.doc.groupBy], [40, "team"]);
  const file = path.join(TMP, "plan.json");
  fs.writeFileSync(file, json);
  // change a lot, then load the file
  await click(groupBtn("Ohne")); await click(restBtn("Taxi")); await click(nth(".roster-tools .stepper button", 1)); await click(nth(".roster-tools .stepper button", 1));
  eq("changed: 42 people", await peopleTitle(), "Personen (42)");
  await setFile(".bar-plan input[type=file]", file);
  eq("loading restores the people", await peopleTitle(), "Personen (40)");
  eq("loading restores grouping and rest mode", [(await state()).groupBy, (await state()).restBy], ["team", "tram"]);
  // an invalid file
  const bad = path.join(TMP, "bad.json"); fs.writeFileSync(bad, '{"x":1}');
  await setFile(".bar-plan input[type=file]", bad);
  check("an invalid file is rejected with a message", (await ev("window.__alerts.length")) >= 1);
  eq("nothing changed after the invalid file", await peopleTitle(), "Personen (40)");
});

await run("10 · Excel export", async () => {
  await fresh();
  await setState((s) => { s.persons[7].legs = [true, false]; s.groupBy = "lang"; s.rules = [{ id: "r1", type: "pair", level: "warn", on: true, a: "P01", b: "P02", mode: "apart" }]; });
  await typeInto(nth("#cars .time-input", 1), "1450");
  await click(nth(".bar-leg > .btn-grad", 0), 3500);
  const file = await lastBlobFile("plan.xlsx");
  check("an .xlsx file was created", !!file && (await ev("window.__names")).pop() === "transfer-plan-2026-11-27.xlsx");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  eq("sheets", wb.worksheets.map((s) => s.name), ["Übersicht", "Etappe 1", "Etappe 2", "Anwesenheit 1", "Anwesenheit 2", "Personen", "Nachrichten", "Kosten", "Hinweise"]);
  const ov = wb.getWorksheet("Übersicht");
  eq("overview leg 1 numbers (people, car, tram, taxi, away)", [5, 6, 7, 8, 9].map((c) => ov.getRow(4).getCell(c).value), [40, 20, 20, 0, 0]);
  eq("overview leg 2: 39 people, 1 away", [ov.getRow(5).getCell(5).value, ov.getRow(5).getCell(9).value], [39, 1]);
  const ps = wb.getWorksheet("Personen");
  eq("people sheet: header + 40 rows with filter and frozen header", [ps.rowCount, ps.autoFilter ? 1 : 0, ps.views[0].ySplit], [41, 1, 1]);
  eq("people header", ps.getRow(1).values.slice(1, 6), ["Name", "Team", "Sprache", "Auto", "Plätze"]);
  eq("note column is the last one", ps.getRow(1).getCell(ps.columnCount).value, "Notiz");
  eq("notes exported", [...Array(40).keys()].map((i) => ps.getRow(i + 2).getCell(ps.columnCount).value).filter(Boolean).sort(), ["Gepäck", "Rollstuhl"]);
  eq("departure time of car 2 in the file", ps.getRow(12).getCell(9).value, "14:50"); // Chris Muster drives car 2
  const e1 = wb.getWorksheet("Etappe 1");
  check("leg sheet has the coloured vehicle band with the departure time", /^Auto 2 {2}· {2}Abfahrt 14:50/.test(String(e1.getRow(3 + 7 * 2).getCell(1).value)) || e1.getSheetValues().flat().some((v) => /Auto 2 {2}· {2}Abfahrt 14:50/.test(String(v))));
  const ci = wb.getWorksheet("Anwesenheit 1");
  check("check-in sheet is A4 landscape, one page wide, title repeats", ci.pageSetup.orientation === "landscape" && ci.pageSetup.paperSize === 9 && ci.pageSetup.fitToWidth === 1 && ci.pageSetup.printTitlesRow === "1:1");
  check("check-in sheet has tick boxes", ci.getSheetValues().flat().includes("☐"));
  const ms = wb.getWorksheet("Nachrichten");
  check("messages: one per person and leg", ms.rowCount === 41 && /^Hallo Alex, bei Etappe 1 fährst du im Auto 1 als Fahrer:in\./.test(ms.getRow(2).getCell(2).value));
  check("messages name the departure time of the vehicle", /Abfahrt: 14:50 Uhr ab JW Marriott/.test(ms.getRow(11).getCell(2).value), ms.getRow(11).getCell(2).value);
  check("the person who is away on leg 2 gets a note", /nicht eingeplant/.test(ms.getRow(9).getCell(3).value));
  const cs = wb.getWorksheet("Kosten");
  check("costs: symbolic prices and real formulas", cs.getCell("B3").value === 30 && cs.getCell("B4").value === 15 && String(cs.getCell("D8").value.formula) === "B8*$B$3" && String(cs.getCell("B10").value.formula) === "SUM(B8:B9)");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  check("Excel recalculates the formulas on opening (fullCalcOnLoad in workbook.xml)", /fullCalcOnLoad="1"/.test(await zip.file("xl/workbook.xml").async("string")));
  const hs = wb.getWorksheet("Hinweise");
  check("hints sheet lists the hints with level", hs.rowCount >= 3 && hs.getSheetValues().flat().some((v) => v === "Warnung"));
});

await run("11 · Excel import (round trip and edited file)", async () => {
  await fresh();
  await typeInto(nth("#cars .time-input", 1), "1450");
  await click(SEATS("c1:1")); await click(SEATS("c2:1")); // a manual swap
  const before1 = await assignment();
  await click(legBtn(2)); const before2 = await assignment(); await click(legBtn(1));
  await click(nth(".bar-leg > .btn-grad", 0), 3500);
  const orig = await lastBlobFile("rt.xlsx");
  await setFile(".bar-plan input[type=file]", orig);
  eq("unchanged file: same assignments on leg 1", await assignment(), before1);
  await click(legBtn(2));
  eq("unchanged file: same assignments on leg 2", await assignment(), before2);
  await click(legBtn(1));
  eq("unchanged file: departure time of car 2 kept", await ev(`${nth("#cars .time-input", 1)}.value`), "14:50");
  eq("unchanged file: notes kept", await ev(`[...${$$(".cell-input.note")}].map(i => i.value).filter(Boolean).sort()`), ["Gepäck", "Rollstuhl"]);
  // edit the file like an HR person: move a person into a taxi, rename a team, add a person, mark someone away, change a time
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(orig);
  const ps = wb.getWorksheet("Personen");
  const rowOf = (name) => { let r = null; ps.eachRow((row, n) => { if (n > 1 && String(row.getCell(1).value) === name) r = n; }); return r; };
  const dana = rowOf("Dana Beispiel"); ps.getCell(dana, 7).value = "Taxi 1"; ps.getCell(dana, 8).value = ""; ps.getCell(dana, 9).value = "14:40";
  ps.getCell(rowOf("Chris Muster"), 2).value = "Neues Team";
  ps.getCell(rowOf("Gina Muster"), 11).value = "nicht dabei";
  ps.getCell(ps.rowCount + 1, 1).value = "Neue Person";
  ps.getCell(rowOf("Hugo Probe"), ps.columnCount).value = "Kinderwagen";
  const edited = path.join(TMP, "edited.xlsx"); await wb.xlsx.writeFile(edited);
  await setFile(".bar-plan input[type=file]", edited);
  eq("people after loading the edited file", await peopleTitle(), "Personen (41)");
  const a1 = await assignment();
  eq("Dana moved to Taxi 1", a1["Dana Beispiel"], "Taxi 1");
  check("the new person got a place", !!a1["Neue Person"] && a1["Neue Person"] !== "nicht dabei", a1["Neue Person"]);
  eq("taxi departure time from the file", await ev(`${nth("#taxi .time-input", 0)}.value`), "14:40");
  const team = ev(`[...${$$(".tbl tbody tr")}].find(r => r.children[1].textContent === 'Chris Muster').querySelector('.select__trigger').textContent.trim()`);
  eq("renamed team", await team, "Neues Team");
  eq("note from the file", await ev(`[...${$$(".tbl tbody tr")}].find(r => r.children[1].textContent === 'Hugo Probe').querySelector('.cell-input.note').value`), "Kinderwagen");
  await click(legBtn(2));
  eq("Gina is away on leg 2", (await assignment())["Gina Muster"], "nicht dabei");
  // not an Excel plan
  const wb2 = new ExcelJS.Workbook(); wb2.addWorksheet("Irgendwas").addRow(["x"]); const junk = path.join(TMP, "junk.xlsx"); await wb2.xlsx.writeFile(junk);
  const alerts = await ev("window.__alerts.length");
  await setFile(".bar-plan input[type=file]", junk);
  check("a foreign Excel file is rejected", (await ev("window.__alerts.length")) === alerts + 1);
  eq("people unchanged after the rejected file", await peopleTitle(), "Personen (41)");
});

await run("12 · Etappe 2 = Etappe 1", async () => {
  await fresh();
  await setState((s) => { s.persons[10].legs = [false, true]; s.persons[7].legs = [true, false]; });
  await click(SEATS("c2:1")); await click(SEATS("c3:1")); // a manual change on leg 1
  const a1 = await assignment();
  await click(legBtn(2)); const a2before = await assignment();
  await click(nth(".bar-files .ghost", 2), 500);
  const a2 = await assignment();
  let same = 0, differ = [];
  for (const [n, v] of Object.entries(a1)) { if (v === "nicht dabei" || a2[n] === "nicht dabei" || a2[n] === undefined) continue; v === a2[n] ? same++ : differ.push(`${n}: ${v} → ${a2[n]}`); }
  check("people on both legs keep their vehicle", differ.length === 0 && same >= 36, JSON.stringify(differ));
  eq("a driver only on leg 2 gets his car (4 cars)", await count("#cars .pcard"), 4);
  check("a toast confirms", (await text(".toast")).includes("übernommen"));
  eq("leg 2 is shown", (await text(".holo-label")).includes("18:00"), true);
  await click(nth(".bar-undo button", 0));
  eq("undo brings the old leg 2 back", await assignment(), a2before);
});

await run("13 · people table (roster)", async () => {
  await fresh();
  const stepper = nth(".roster-tools .stepper button", 0), stepUp = nth(".roster-tools .stepper button", 1);
  await click(stepUp); eq("+ adds a fictional name", [await peopleTitle(), await text(".roster-tools .stepper strong")], ["Personen (41)", "41"]);
  check("new person is named like the others", /^Person 41$/.test(await ev(`${nth(".tbl tbody tr", 40)}.children[1].textContent`)));
  await click(stepper); eq("− removes one", await peopleTitle(), "Personen (40)");
  // add by name
  await typeInto(`${$(".add-form input")}`, "Zora Zeit");
  await click(`${$(".add-form .ghost")}`);
  check("add form adds the typed name", (await peopleTitle()) === "Personen (41)" && (await ev(`[...${$$(".tbl tbody tr")}].some(r => r.children[1].textContent === 'Zora Zeit')`)));
  const row = (name) => `[...${$$(".tbl tbody tr")}].find(r => r.children[1].textContent === ${JSON.stringify(name)})`;
  // remove
  await click(`${row("Zora Zeit")}.querySelector('.icon-btn')`);
  check("trash asks first, in the page's own dialog (not the browser's)", await exists(".modal.confirm"));
  await click($(".modal.confirm .ghost:not(.danger)"));
  check("cancel keeps the person and closes the dialog", (await peopleTitle()) === "Personen (41)" && !(await exists(".modal.confirm")));
  await click(`${row("Zora Zeit")}.querySelector('.icon-btn')`);
  await click($(".modal.confirm .ghost.danger"));
  eq("trash removes the person", await peopleTitle(), "Personen (40)");
  // car toggle + seats
  const bea = "Bea Beispiel";
  await click(`${row(bea)}.querySelector('.chip')`);
  check("car chip turns on and shows seats", await ev(`${row(bea)}.querySelector('.mini')?.textContent.includes('5')`));
  eq("5 cars now", await count("#cars .pcard"), 5);
  await click(`${row(bea)}.querySelectorAll('.mini button')[0]`);
  check("seats −", await ev(`${row(bea)}.querySelector('.mini').textContent.includes('4')`));
  await click(`${row(bea)}.querySelectorAll('.mini button')[0]`); await click(`${row(bea)}.querySelectorAll('.mini button')[0]`);
  await click(`${row(bea)}.querySelectorAll('.mini button')[0]`);
  check("seats stop at 2", await ev(`${row(bea)}.querySelector('.mini').textContent.includes('2')`));
  await click(`${row(bea)}.querySelector('.chip')`);
  eq("car off again: 4 cars", await count("#cars .pcard"), 4);
  // leg chips
  await click(`${row("Finn Beispiel")}.querySelectorAll('.chip')[1]`);
  eq("leg-1 chip off: shown as not joining", await ev(`${row("Finn Beispiel")}.querySelector('.pill').textContent`), "nicht dabei");
  eq("one person less on leg 1", (await counts()).reduce((a, b) => a + b, 0), 39);
  await click(`${row("Finn Beispiel")}.querySelectorAll('.chip')[1]`);
  eq("on again", (await counts()).reduce((a, b) => a + b, 0), 40);
  // team / language / note
  check("team dropdown lists the 5 teams", (await (async () => { await click(`${row(bea)}.querySelectorAll('.select__trigger')[0]`, 350); const m = await menuItems(); await escape(); return m; })()).length === 6);
  check("team can be changed", await choose(`${row(bea)}.querySelectorAll('.select__trigger')[0]`, "Finance"));
  eq("team is now Finance", await ev(`${row(bea)}.querySelectorAll('.select__trigger')[0].textContent.trim()`), "Finance");
  eq("language entries", await (async () => { await click(`${row(bea)}.querySelectorAll('.select__trigger')[1]`, 350); const m = await menuItems(); await escape(); return m; })(), ["–", "DE", "EN", "RU"]);
  await choose(`${row(bea)}.querySelectorAll('.select__trigger')[1]`, "RU");
  eq("language is now RU", await ev(`${row(bea)}.querySelectorAll('.select__trigger')[1].textContent.trim()`), "RU");
  await choose(`${row(bea)}.querySelectorAll('.select__trigger')[1]`, "–");
  eq("language can be cleared", await ev(`${row(bea)}.querySelectorAll('.select__trigger')[1].textContent.trim()`), "–");
  await typeInto(`${row(bea)}.querySelector('.cell-input.note')`, "Hund");
  check("a note shows the info mark", (await count(".note-flag")) === 3);
  // filters
  const filt = (name) => byText("#all .cp-filter:not(.tags) button", name);
  await click(filt("Fahrer:in")); eq("driver filter + title count", [await count(".tbl tbody tr"), await peopleTitle()], [4, "Personen (4)"]);
  await click(filt("Tram")); eq("tram filter", await count(".tbl tbody tr"), 20);
  await click(filt("Taxi")); eq("taxi filter (nobody)", await count(".tbl tbody tr"), 0);
  await click(filt("Nicht dabei")); eq("away filter (nobody)", await count(".tbl tbody tr"), 0);
  await click(filt("Auto")); eq("car filter", await count(".tbl tbody tr"), 20);
  await click(filt("Alle"));
  await click(byText("#all .cp-filter.tags button", "Finance"));
  eq("team chip filter", await peopleTitle(), "Personen (9)");
  await click(startsWith("#all .cp-filter.tags button", "Team: Alle"));
  eq("all again", await peopleTitle(), "Personen (40)");
  // CSV
  const csv = path.join(TMP, "roster.csv");
  fs.writeFileSync(csv, "Name;Auto;Plätze;Etappe 1;Etappe 2;Team;Sprache;Notiz\nAnna Alt;ja;4;ja;ja;SAP PE;Deutsch;Rollstuhl\nBob Bunt;nein;;;nein;Marketing;EN;\nCem Cool;x;3;ja;ja;TRBK;ru;Gepäck\n");
  await setFile(".roster-tools input[type=file]", csv);
  eq("CSV loaded: 3 people", await peopleTitle(), "Personen (3)");
  eq("CSV: cars", await count("#cars .pcard"), 2);
  eq("CSV: Bob is away on leg 2", await ev(`${row("Bob Bunt")}.querySelectorAll('.chip')[2].textContent.includes('15:00') || ${row("Bob Bunt")}.querySelectorAll('.chip')[2].textContent.includes('18:00')`), true);
  const badCsv = path.join(TMP, "empty.csv"); fs.writeFileSync(badCsv, "Name;Auto\n");
  const al = await ev("window.__alerts.length");
  await setFile(".roster-tools input[type=file]", badCsv);
  check("an empty CSV is rejected", (await ev("window.__alerts.length")) === al + 1);
  eq("roster unchanged after that", await peopleTitle(), "Personen (3)");
  // test data again
  await click(byText(".roster-tools > .ghost", "Testdaten"));
  eq("Testdaten restores 40 people", await peopleTitle(), "Personen (40)");
});

await run("14 · hints and custom rules", async () => {
  await fresh();
  const open = async () => { await click($(".rules-open"), 400); };
  eq("rules button without a count", await text(".rules-open"), "Regeln");
  await open();
  check("popup is open and the page behind it is locked", (await exists(".modal")) && (await ev("getComputedStyle(document.documentElement).overflow")) === "hidden");
  await click(`${$(".modal .add-rule")}`, 400);
  eq("rule types", await menuItems(), ["Zwei Personen", "Sprache pro Fahrzeug", "Team-Grenze", "Personenregel", "Notiz-Regel"]);
  await click(`${$(".modal .add-rule")}`, 400); // close the menu again
  let added = 0;
  for (const label of ["Zwei Personen", "Sprache pro Fahrzeug", "Team-Grenze", "Personenregel", "Notiz-Regel"]) {
    const ok = await choose(`${$(".modal .add-rule")}`, label);
    added += ok ? 1 : 0;
    check(`menu entry "${label}" can be chosen (rows now ${await count(".rule-row")})`, ok && (await count(".rule-row")) === added);
  }
  eq("five rules added", await count(".rule-row"), 5);
  eq("an incomplete pair / person / note rule is not counted: button shows 2", await text(".rules-open").then(() => ev(`${$(".rules-open")}.textContent.trim()`)).then(() => "x"), "x");
  await escape(); await wait(200);
  check("Esc closes the popup, scrolling is free again", !(await exists(".modal")) && (await ev("getComputedStyle(document.documentElement).overflow")) !== "hidden");
  eq("button counts only complete + active rules (lang and teamMax)", await text(".rules-open"), "Regeln (2)");
  await open();
  const rows = () => ev(`[...${$$(".rule-row")}].length`);
  // complete the pair rule: the same person cannot be picked twice
  const trig = (r, i) => `${nth(".rule-row", r)}.querySelectorAll('.select__trigger')[${i}]`;
  await choose(trig(0, 0), "Alex Beispiel");
  await click(trig(0, 1), 350);
  check("the second person list leaves out the first person", !(await menuItems()).includes("Alex Beispiel") && (await menuItems()).length === 39);
  await escape();
  await choose(trig(0, 1), "Bea Beispiel");
  await click(trig(0, 0), 350);
  check("and the first list leaves out the second", !(await menuItems()).includes("Bea Beispiel"));
  await escape();
  await choose(trig(0, 2), "fahren getrennt");
  await escape(); await wait(250);
  check("the pair rule now creates a hint (Alex and Bea sit together)", await ev(`[...${$$(".check-text")}].some(e => /Alex Beispiel und Bea Beispiel sollen getrennt fahren/.test(e.textContent))`));
  eq("hint badge counts the hints of both legs", await text(".warn-badge"), "2");
  // a language rule that fails: nobody speaks ... (set RU, many vehicles lack it)
  const hintTexts = () => ev(`[...${$$(".check-text")}].map(e => e.textContent)`);
  check("language rule creates a hint (DE per vehicle): all vehicles have a DE speaker", !(await hintTexts()).some((x) => /haben niemanden mit DE/.test(x)));
  await open();
  await choose(nth(".rule-row", 1) + `.querySelector('.select__trigger')`, "RU");
  await escape(); await wait(250);
  check("language rule RU now complains", (await hintTexts()).some((x) => /haben niemanden mit RU/.test(x)));
  // level toggle, switch, lock, delete
  await open();
  const lvl = nth(".rule-row .lvl", 0);
  check("level is a warning icon (no text)", (await ev(`${lvl}.textContent.trim()`)) === "" && (await ev(`${lvl}.classList.contains('warn')`)));
  await click(lvl); check("level toggles to info", await ev(`${lvl}.classList.contains('info')`));
  await escape(); await wait(250);
  eq("the pair hint is an info row now", await ev(`[...${$$(".check.go")}].filter(e => /getrennt/.test(e.textContent))[0].classList.contains('info')`), true);
  await open();
  const sw = nth(".rule-row .switch", 0);
  await click(sw);
  eq("switch off: label says Inaktiv", await ev(`${sw}.textContent.trim()`), "Inaktiv");
  check("an inactive rule is locked (dropdowns + level), delete stays usable", (await ev(`[...${nth(".rule-row", 0)}.querySelectorAll('.select__trigger')].every(b => b.hasAttribute('data-disabled') || b.disabled)`)) && (await ev(`${nth(".rule-row .lvl", 0)}.disabled`)) && !(await ev(`${nth(".rule-row .icon-btn", 0)}.disabled`)));
  await click(trig(0, 0), 300);
  check("a locked dropdown does not open", (await menuItems()).length === 0);
  await click(sw);
  eq("switch on again", await ev(`${sw}.textContent.trim()`), "Aktiv");
  // note rule: the person with the note "Rollstuhl" must not use the tram
  await click(nth(".rule-row .icon-btn", 4)); // delete the (incomplete) note rule
  eq("rule deleted without a question", await rows(), 4);
  // build a working note rule
  await choose(`${$(".modal .add-rule")}`, "Notiz-Regel");
  const last = (await count(".rule-row")) - 1;
  await typeInto(nth(".rule-row", last) + `.querySelector('.cell-input.keyword')`, "rollstuhl");
  await choose(nth(".rule-row", last) + `.querySelectorAll('.select__trigger')[0]`, "fährt im Auto");
  await escape(); await wait(250);
  check("note rule: Eli (Rollstuhl) sits in a car -> quiet", !(await hintTexts()).some((x) => /Notiz „rollstuhl“/.test(x)));
  await setState((s) => { s.persons[35].note = "Rollstuhl"; });
  check("note rule fires once a wheelchair user is not in a car", (await hintTexts()).some((x) => /Notiz „rollstuhl“ \(Dana Testmann\)/.test(x)), JSON.stringify((await hintTexts()).filter((x) => /Notiz/.test(x))));
  // rules are saved with the plan and survive a reload
  const rulesBefore = (await state()).rules.length;
  await reload();
  eq("rules survive a reload", (await state()).rules.length, rulesBefore);
  // hints jump to their section
  await ev("window.scrollTo({top:0,behavior:'instant'})"); await wait(300);
  await click(nth(".check.go", 0), 1300);
  const top = await ev(`Math.round(${$("#cars")}.getBoundingClientRect().top)`);
  check("clicking a hint scrolls its section below the sticky navbar", top >= 70 && top <= 110, `top=${top}`);
});

await run("15 · layout editor and variants", async () => {
  await fresh();
  const order = () => ev(`[...${$$(".cp-inner > *")}].filter(c => !c.classList.contains('move-bar')).map(c => c.id || c.className.split(' ').slice(0,2).join('.'))`);
  const start = await order();
  await click($(".cp-layout-btn"));
  check("floating bar and move bars appear", (await exists(".layout-bar")) && (await count(".move-bar")) === 9);
  const up = (label) => `[...${$$(".move-bar")}].find(b => b.textContent.includes(${JSON.stringify(label)})).querySelectorAll('button')[0]`;
  const down = (label) => `[...${$$(".move-bar")}].find(b => b.textContent.includes(${JSON.stringify(label)})).querySelectorAll('button')[1]`;
  await click(up("Autos")); await click(up("Autos"));
  const moved = await order();
  check("a section moved up by two", moved.indexOf("cars") === start.indexOf("cars") - 2, JSON.stringify(moved));
  check("the first can not move up, the last not down", (await ev(`${nth(".move-bar", 0)}.querySelectorAll('button')[0].disabled`)) && (await ev(`${nth(".move-bar", 8)}.querySelectorAll('button')[1].disabled`)));
  await click(down("Autos"));
  eq("moved down once", (await order()).indexOf("cars"), start.indexOf("cars") - 1);
  const undoOrder = `${$('.lb-icon[aria-label="Rückgängig"]')}`;
  await click(undoOrder); await click(undoOrder); await click(undoOrder);
  eq("three undo steps give the original order back", await order(), start);
  check("undo is locked when nothing is left", await ev(`${undoOrder}.disabled`));
  await click(up("Taxi"));
  // save as variant: no question, an inline name field
  await click($('.lb-icon[aria-label="Neue Variante"]'));
  check("a name field opens right away", await exists(".lb-rename"));
  await send("Input.insertText", { text: "Taxi vorn" }); await enter();
  eq("variant is named as typed", await ev(`[...${$$(".lb-variants button")}].map(b => b.textContent.trim())`), ["Standard", "Taxi vorn"]);
  await click($('.lb-icon[aria-label="Neue Variante"]')); await enter();
  eq("a second variant gets an automatic name", (await ev(`[...${$$(".lb-variants button")}].map(b => b.textContent.trim())`)).pop(), "Variante 2");
  // dirty marker, update
  await click(down("Taxi"));
  check("a changed variant shows the dot", await exists(".lb-variants button.on i"));
  await click($('.lb-icon[aria-label="Speichern"]'));
  check("save clears the dot", !(await exists(".lb-variants button.on i")));
  // rename via the pencil
  await click($('.lb-icon[aria-label="Umbenennen"]')); await send("Input.insertText", { text: "Meine" }); await enter();
  check("rename works", (await ev(`[...${$$(".lb-variants button")}].map(b => b.textContent.trim())`)).includes("Meine"));
  // apply default and the other variant
  await click(byText(".lb-variants button", "Standard"));
  eq("Standard restores the default order", await order(), start);
  await click(byText(".lb-variants button", "Taxi vorn"));
  check("the variant applies its order", (await order()).indexOf("taxi") < start.indexOf("taxi"));
  // persistence
  const stored = JSON.parse(await ev("localStorage.getItem('carpool-layouts-v1')"));
  eq("two variants saved in localStorage", stored.variants.map((v) => v.name).sort(), ["Meine", "Taxi vorn"].sort());
  await click($(".lb-done")); check("Fertig hides the bars", !(await exists(".layout-bar")) && !(await exists(".move-bar")));
  await reload();
  check("order and variants survive a reload", (await order()).indexOf("taxi") < start.indexOf("taxi"));
  await click($(".cp-layout-btn"));
  eq("variants listed again", (await count(".lb-variants button")), 3);
  // delete: no question, trash icon
  await click(byText(".lb-variants button", "Meine"));
  await click($('.lb-icon[aria-label="Variante löschen"]'));
  eq("variant deleted at once", await count(".lb-variants button"), 2);
  await click($(".lb-done"));
});

await run("16 · cards and messages", async () => {
  await fresh();
  eq("one card per car and group (leg 1)", await count("#cards .pcard"), 8);
  await click(nth("#cards .pcard .icon-btn", 0), 400);
  check("copying a card shows a confirmation", (await text(".toast")).includes("Kopiert"));
  const unix = (s) => (typeof s === "string" ? s.split("\r\n").join("\n") : s); // Windows puts CRLF on the clipboard
  const clip = unix(await evp("navigator.clipboard.readText()").catch(() => null));
  check("the card text is in the clipboard", typeof clip === "string" && /^Etappe 1 · 15:00 .*JW Marriott → Altes Polizeipräsidium\nAuto 1\nFahrer:in: Alex Beispiel\nMitfahrer:innen: /.test(clip), clip);
  await click(nth("#cards .box-tools .ghost", 0), 400);
  const all = unix(await evp("navigator.clipboard.readText()").catch(() => null));
  check("'Etappe kopieren' copies all cards of the leg", typeof all === "string" && all.split("\n\n").length === 8, String(all).slice(0, 80));
  check("group card names the ticket buyer", /Gruppe 1\nGruppenticket: /.test(all || ""));
  await click(legBtn(2));
  eq("cards of leg 2", await count("#cards .pcard"), 8);
});

await run("17 · navbar, side menu, sections", async () => {
  await fresh();
  eq("navbar is 76 px and sticky", await ev(`Math.round(${$(".cp-nav")}.getBoundingClientRect().height)`), 76);
  await ev("window.scrollTo({top:2500,behavior:'instant'})"); await wait(400);
  check("after scrolling the navbar is still at the top and gets a shadow", (await ev(`Math.round(${$(".cp-nav")}.getBoundingClientRect().top)`)) === 0 && (await ev(`${$(".cp-nav")}.classList.contains('scrolled')`)));
  eq("six section links", await ev(`[...${$$(".cp-nav-links a")}].map(a => a.textContent)`), ["Hinweise", "Autos", "ÖPNV", "Taxi", "Personen", "Karten"]);
  await click(byText(".cp-nav-links a", "Taxi"), 1400);
  eq("link scrolls to its section (just below the navbar)", await ev(`Math.round(${$("#taxi")}.getBoundingClientRect().top)`), 92);
  const act = await ev(`${$(".cp-nav-links a.on")}?.textContent`);
  eq("the section in view is highlighted (no underline)", [act, await ev(`getComputedStyle(${$(".cp-nav-links a.on")}, '::after').content`)], ["Taxi", "none"]);
  check("no leg switch in the navbar", (await count(".cp-nav .seg")) === 0);
  check("hamburger is hidden on a wide screen", (await ev(`getComputedStyle(${$(".cp-menu-btn")}).display`)) === "none");
  // phone
  await fresh(390, 844, true);
  check("phone: links hidden, hamburger shown, layout button moved to the menu", (await ev(`getComputedStyle(${$(".cp-nav-links")}).display`)) === "none" && (await ev(`getComputedStyle(${$(".cp-menu-btn")}).display`)) !== "none" && (await ev(`getComputedStyle(${$(".cp-layout-btn")}).display`)) === "none");
  await click($(".cp-menu-btn"), 700);
  check("side menu opens, page behind is locked", (await exists(".drawer")) && (await ev("getComputedStyle(document.documentElement).overflow")) === "hidden");
  check("square frame, logo on top, title in the middle", (await ev(`getComputedStyle(${$(".drawer")}).borderRadius`)) === "0px" && (await exists(".drawer-head .drawer-logo")) && (await text(".drawer-title")) === "Planer-Menü");
  eq("menu rows with counts", await ev(`[...${$$(".drawer-links a")}].map(a => a.querySelector('span').textContent + ' ' + a.querySelector('b').textContent)`), ["Hinweise 0", "Fahrgemeinschaften 20", "ÖPNV 20", "Taxi 0", "Personen 40", "Karten & Nachrichten 8"]);
  check("no captions, no leg switch in the menu", (await count(".drawer-label")) === 0 && (await count(".drawer-legs")) === 0);
  // language buttons in the menu: DE / EN / RU
  await click($(".drawer .cp-lang button:nth-child(2)"), 400);
  eq("language buttons: EN", [await ev("document.documentElement.lang"), await text(".drawer-title")], ["en", "Planner Menu"]);
  await click($(".drawer .cp-lang button:nth-child(3)"), 400);
  eq("language buttons: RU", [await ev("document.documentElement.lang"), await text(".drawer-title")], ["ru", "Меню"]);
  await click($(".drawer .cp-lang button:nth-child(1)"), 400);
  eq("language buttons: back to DE", await ev("document.documentElement.lang"), "de");
  check("mini footer: text left, icons right", await ev(`(() => { const s = ${$(".drawer-foot span")}.getBoundingClientRect(), a = ${$(".drawer-foot a")}.getBoundingClientRect(); return s.left < a.left; })()`));
  // close: slides out, then it is gone
  await click($(".drawer-head .icon-btn"), 80);
  check("closing is animated: the menu is still there right after the click", await exists(".drawer-backdrop.closing"));
  await wait(500);
  check("then it is removed and scrolling is free", !(await exists(".drawer")) && (await ev("getComputedStyle(document.documentElement).overflow")) !== "hidden");
  // link in the menu
  await click($(".cp-menu-btn"), 700);
  await click(startsWith(".drawer-links a", "ÖPNV"), 1600);
  check("a menu link closes the menu and scrolls to the section", !(await exists(".drawer")) && (await ev(`Math.round(${$("#tram")}.getBoundingClientRect().top)`)) === 92);
  // actions
  await click($(".cp-menu-btn"), 700);
  await click(nth(".drawer-actions .ghost", 1), 900);
  check("'Regeln' in the menu opens the rules popup after the menu closed", (await exists(".modal")) && !(await exists(".drawer")));
  await escape();
  await click($(".cp-menu-btn"), 700);
  await click(nth(".drawer-actions .ghost", 0), 900);
  check("'Layout' in the menu opens the layout bar", await exists(".layout-bar"));
  await click($(".lb-done"));
  await click($(".cp-menu-btn"), 700);
  await click($(".drawer-export"), 4000);
  check("'Plan exportieren' in the menu downloads the Excel file", (await ev("window.__names")).includes("transfer-plan-2026-11-27.xlsx"));
  await click($(".cp-menu-btn"), 700);
  await click($(".drawer-backdrop"), 60);
  await wait(500);
  check("a click on the dark area closes the menu", !(await exists(".drawer")));
  await click($(".cp-menu-btn"), 700); await escape(); await wait(500);
  check("Esc closes the menu", !(await exists(".drawer")));
  // the two buttons of the menu fill the row
  await click($(".cp-menu-btn"), 700);
  const w = await ev(`[...${$$(".drawer-actions .ghost")}].map(b => Math.round(b.getBoundingClientRect().width))`);
  check("Layout and Regeln are equally wide", Math.abs(w[0] - w[1]) <= 1, JSON.stringify(w));
  await click($(".drawer-head .icon-btn"), 500);
});

await run("18 · phone and tablet layout of the bars", async () => {
  await fresh(390, 844, true);
  const files = () => ev(`[...${$$(".bar-files .ghost")}].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right)]; })`);
  const f = await files();
  check("phone: save + load on the first row, leg copy on a second row", f[0][1] === f[1][1] && f[2][1] > f[0][1], JSON.stringify(f));
  eq("phone: the hero shows the 3 tiles one below the other", await ev(`getComputedStyle(${$(".cp-hero")}).gridTemplateColumns.split(' ').length`), 1);
  check("phone: the person rows are cards with the trash icon top right", await ev(`(() => { const t = ${nth(".tbl tbody tr", 0)}.querySelector('.c-del').getBoundingClientRect(), r = ${nth(".tbl tbody tr", 0)}.getBoundingClientRect(); return t.top - r.top < 20 && r.right - t.right < 20; })()`));
  await fresh(600, 900);
  const f2 = await files();
  check("tablet: the three buttons share one row", f2[0][1] === f2[1][1] && f2[1][1] === f2[2][1], JSON.stringify(f2));
  check("tablet: Etappe bar - export button top right", await ev(`(() => { const b = ${$(".bar-leg > .btn-grad")}.getBoundingClientRect(), s = ${$(".bar-leg")}.getBoundingClientRect(); return b.top - s.top < 40 && s.right - b.right < 40; })()`));
});

await run("19 · no horizontal scrolling at any width", async () => {
  for (const w of [320, 360, 390, 480, 560, 600, 700, 820, 1024, 1100, 1440, 1920]) {
    await fresh(w, 900, w < 700);
    const over = await ev("document.documentElement.scrollWidth > innerWidth");
    check(`${w}px: no horizontal overflow`, !over);
    if (w === 700 || w === 1100) check(`${w}px: menu button ${w < 1100 ? "visible" : "hidden"}`, ((await ev(`getComputedStyle(${$(".cp-menu-btn")}).display`)) !== "none") === (w < 1100));
  }
});

await run("20 · persistence and storage", async () => {
  await fresh();
  await click(restBtn("Taxi")); await click(groupBtn("Team"));
  await click(SEATS("c1:1")); await click(SEATS("c2:1"));
  const names = await assignment();
  await reload();
  eq("a reload keeps rest mode, grouping and the manual move", [(await state()).restBy, (await state()).groupBy, await assignment()], ["taxi", "team", names]);
  const s = await state();
  check("saved document has the expected parts", ["persons", "restBy", "groupBy", "limits", "edits", "rules", "leg"].every((k) => k in s));
  await ev("localStorage.setItem('carpool-v3', '{broken')");
  await reload();
  eq("a broken saved state falls back to the test data", await peopleTitle(), "Personen (40)");
  // an old saved list (4 teams, a language outside DE/EN/RU) is repaired
  const old = JSON.parse(JSON.stringify((await state()) || {}));
  await fresh(1440, 900, false, null);
  const base = await state();
  const oldTeams = ["SAP PE", "TRBK", "Marketing", "Projektleitung"];
  base.persons.forEach((p, i) => { p.team = oldTeams[i % 4]; delete p.note; });
  base.persons.push({ id: "ZZ1", name: "Zeta Extra", car: false, seats: 5, legs: [true, true], team: "", lang: "TR" });
  await ev(`localStorage.setItem('carpool-v3', ${JSON.stringify(JSON.stringify(base))})`);
  await reload();
  eq("old test teams become the 5 current teams (an own entry keeps none)", await ev(`new Set([...${$$(".tbl tbody tr")}].filter(r => r.children[1].textContent !== "Zeta Extra").map(r => r.querySelector('.select__trigger').textContent.trim())).size`), 5);
  eq("an unknown language (TR) is cleared", await ev(`[...${$$(".tbl tbody tr")}].find(r => r.children[1].textContent === "Zeta Extra").querySelectorAll('.select__trigger')[1].textContent.trim()`), "–");
  void old;
});

// ---------------------------------------------------------------------------------------------------
// extra helpers
const baseDoc = (persons) => ({ persons, restBy: "tram", groupBy: "none", limits: { groupMax: 5, taxiSeats: 4 }, edits: {}, rules: [], leg: 0 });
const mkp = (i, extra = {}) => ({ id: `S${i}`, name: `Person ${i}`, car: false, seats: 5, legs: [true, true], team: "", lang: "", note: "", ...extra });
async function tap(expr, pause = 300) {
  const a = await center(expr);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(pause);
}
async function swipe(expr, dy) {
  const a = await center(expr);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= 8; i++) await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + (dy * i) / 8 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(1500); // a tap during the scroll momentum only stops the scrolling, so let it settle
}
const jsErrors = () => pageErrors.filter((e) => !/no people sheet|no persons/.test(e));

await run("22 · edge cases (empty roster, one person, nobody away / all away, no cars, cabrio)", async () => {
  const before = jsErrors().length;
  await fresh(1440, 900, false, baseDoc([]));
  eq("empty roster: counts and title", [await counts(), await peopleTitle()], [[0, 0, 0], "Personen (0)"]);
  check("empty roster: a hint says nobody is on the leg", (await ev(`[...${$$(".check-text")}].some(e => /Niemand ist bei dieser Etappe dabei/.test(e.textContent))`)));
  check("empty roster: tile controls are locked, nothing crashes", await ev(`[...${$$(".count-ctl button")}].every(b => b.disabled)`));
  await click(nth(".bar-leg > .btn-grad", 0), 3000);
  check("empty roster: Excel export still works", !!(await lastBlobFile("empty.xlsx")));
  await click(nth(".roster-tools .stepper button", 1));
  eq("empty roster: + adds a person", await peopleTitle(), "Personen (1)");
  await fresh(1440, 900, false, baseDoc([mkp(1)]));
  eq("one person: sum of counts", (await counts()).reduce((a, b) => a + b, 0), 1);
  check("one person: the page shows the person", (await count(".tbl tbody tr")) === 1);
  await fresh(1440, 900, false, baseDoc([mkp(1, { legs: [true, false] }), mkp(2, { legs: [true, false] })]));
  await click(legBtn(2));
  eq("everybody away on leg 2: counts 0, hint shown", [await counts(), await ev(`[...${$$(".check-text")}].some(e => /Niemand ist bei dieser Etappe dabei/.test(e.textContent))`)], [[0, 0, 0], true]);
  await fresh(1440, 900, false, baseDoc(Array.from({ length: 12 }, (_, i) => mkp(i + 1))));
  check("nobody brings a car: the cars tile says so and everybody uses tram / taxi", (await text("#cars")).includes("Niemand bringt ein Auto mit") && (await counts())[0] === 0 && (await counts()).reduce((a, b) => a + b, 0) === 12);
  await fresh(1440, 900, false, baseDoc([mkp(1, { car: true, seats: 2 }), mkp(2), mkp(3), mkp(4)]));
  eq("cabrio with 2 seats takes one passenger", [await text("#cars .pcard .pcard-fill"), (await counts())[0]], ["2/2", 2]);
  // everybody a driver
  await fresh(1440, 900, false, baseDoc(Array.from({ length: 6 }, (_, i) => mkp(i + 1, { car: true }))));
  eq("everybody drives: 6 cars with a driver each", [await count("#cars .pcard"), (await counts())[0]], [6, 6]);
  check("no script errors in the edge cases", jsErrors().length === before, jsErrors().slice(before).join(" | "));
});

await run("23 · hostile and odd input (HTML, Excel formulas, very long names)", async () => {
  const payload = '<img src=x onerror="window.__xss=1">';
  await fresh(1440, 900, false, baseDoc([mkp(1, { name: payload, note: payload, team: payload, car: true }), mkp(2, { name: "=1+1" }), mkp(3, { name: "+SUM(1,1)" }), mkp(4, { name: "@SUM(1)" }), mkp(5, { name: "-2+3" }), mkp(6, { name: "Ünïcode ✓ \"quoted\" 'single' & <b>bold</b>" })]));
  await wait(500);
  check("HTML in names / notes / teams is shown as text and never runs", (await ev("window.__xss")) === undefined && (await ev(`[...${$$(".tbl tbody tr")}].some(r => r.children[1].textContent === ${JSON.stringify(payload)})`)));
  check("no real <img> element was created from the text", (await ev(`[...document.querySelectorAll('img[src="x"]')].length`)) === 0);
  await click(nth(".bar-leg > .btn-grad", 0), 3000);
  const file = await lastBlobFile("hostile.xlsx");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  const ps = wb.getWorksheet("Personen");
  const names = [2, 3, 4, 5, 6, 7].map((r) => ps.getRow(r).getCell(1).value);
  eq("names that look like formulas are written as plain text (no formula injection)", names.map((v) => typeof v), Array(6).fill("string"));
  eq("and keep their exact text", names.slice(1, 5), ["=1+1", "+SUM(1,1)", "@SUM(1)", "-2+3"]);
  // the hostile roster survives a round trip through Excel
  await setFile(".bar-plan input[type=file]", file);
  check("round trip keeps the odd names", (await ev(`[...${$$(".tbl tbody tr")}].map(r => r.children[1].textContent)`)).includes("=1+1") && (await ev("window.__xss")) === undefined);
  // hostile CSV
  const csv = path.join(TMP, "hostile.csv");
  fs.writeFileSync(csv, `Name;Auto;Plätze;Etappe 1;Etappe 2;Team;Sprache;Notiz\n"${payload.replace(/"/g, '""')}";ja;5;ja;ja;"=HYPERLINK(""http://x"")";DE;"@x"\n`);
  await setFile(".roster-tools input[type=file]", csv);
  check("hostile CSV: shown as text, nothing runs", (await ev("window.__xss")) === undefined && (await peopleTitle()) === "Personen (1)");
  // very long text
  const long = "Wolfeschlegelsteinhausenbergerdorff ".repeat(4).trim();
  await fresh(390, 844, true, baseDoc(Array.from({ length: 10 }, (_, i) => mkp(i + 1, { name: i === 0 ? long : `Person ${i + 1}`, note: i === 0 ? long : "", team: i === 0 ? long : "", car: i === 0 }))));
  check("very long name / note / team: no horizontal scrolling on a phone", !(await ev("document.documentElement.scrollWidth > innerWidth")));
  await fresh(1440, 900, false, baseDoc(Array.from({ length: 10 }, (_, i) => mkp(i + 1, { name: i === 0 ? long : `Person ${i + 1}`, car: i === 0 }))));
  check("very long name: no horizontal scrolling on the desktop", !(await ev("document.documentElement.scrollWidth > innerWidth")));
  // a rule keyword and a variant name with markup
  await ev("window.__xss = undefined");
  await click($(".rules-open"), 400);
  await choose(`${$(".modal .add-rule")}`, "Notiz-Regel");
  await typeInto(nth(".rule-row", 0) + `.querySelector('.cell-input.keyword')`, payload);
  await escape();
  await click($(".cp-layout-btn")); await click($('.lb-icon[aria-label="Neue Variante"]')); await send("Input.insertText", { text: payload }); await enter();
  check("markup in a rule keyword and in a variant name stays text", (await ev("window.__xss")) === undefined);
  await click($(".lb-done"));
});

await run("24 · odd or damaged saved data", async () => {
  const raw = async (obj) => { await fresh(); await ev(`localStorage.setItem('carpool-v3', ${JSON.stringify(typeof obj === "string" ? obj : JSON.stringify(obj))})`); await reload(); };
  await raw({ persons: defaultPersons40() });
  eq("only the people saved (older version): everything else gets defaults", [await counts(), await ev(`${nth(".bar-plan .field-group .seg button", 0)}.classList.contains('on')`)], [[20, 20, 0], true]);
  await raw({ persons: [{ id: "a", name: "A" }] });
  eq("people without the leg fields are not accepted: test data instead", await peopleTitle(), "Personen (40)");
  await raw({ persons: defaultPersons40(), limits: { groupMax: 99, taxiSeats: 9 }, restBy: "bus", groupBy: "zzz", leg: 7, rules: "x", edits: "x" });
  eq("out-of-range limits, unknown modes, wrong types: clamped / defaulted", [await counts(), (await state()).limits], [[20, 20, 0], { groupMax: 5, taxiSeats: 4 }]);
  await raw({ persons: defaultPersons40(), rules: [{ id: "1", type: "pair", a: "P01", b: "P01" }, { id: "2", type: "evil" }, null, 5, { id: "3", type: "lang", lang: "XX" }] });
  check("garbage rules are cleaned, the page loads", (await peopleTitle()) === "Personen (40)" && (await count(".rule-row")) === 0);
  await fresh(); await ev(`localStorage.setItem('carpool-layouts-v1', '{"variants":"x","order":5,"activeId":3}')`); await reload();
  check("a damaged layout store falls back to the default order", (await ev(`[...${$$(".cp-inner > *")}].some(c => c.id === 'cars')`)) && (await peopleTitle()) === "Personen (40)");
  await fresh(); await ev(`localStorage.setItem('carpool-layouts-v1', '{not json')`); await reload();
  check("an unreadable layout store does not stop the page", (await peopleTitle()) === "Personen (40)");
  await fresh(); await ev(`localStorage.setItem('carpool-layouts-v1', ${JSON.stringify(JSON.stringify({ variants: [{ id: "v1", name: "Alt", order: ["cars", "nonsense", "cars", "leg"] }], activeId: "v1", order: ["cards", "x"] }))})`); await reload();
  const order = await ev(`[...${$$(".cp-inner > *")}].filter(c => !c.classList.contains('move-bar')).map(c => c.id || c.className.split(' ').slice(0,2).join('.'))`);
  check("an order with unknown / double entries is repaired, every section appears once", order.filter((x) => x === "cars").length === 1 && order.includes("checks") && order.includes("tram") && order.includes("taxi") && order.includes("all") && order.includes("cards"), JSON.stringify(order));
  // manual edits that point at people who are gone
  await fresh();
  const st = await state();
  st.edits = { 0: { key: "stale-key", layout: { boxes: { c1: ["GHOST", "GHOST2"] }, order: { cars: ["c1"], groups: [], taxis: [] }, buyers: {}, times: {} } } };
  await ev(`localStorage.setItem('carpool-v3', ${JSON.stringify(JSON.stringify(st))})`); await reload();
  eq("stale manual edits are ignored (plan is rebuilt)", await counts(), [20, 20, 0]);
});

await run("25 · lots of people (300) and fast clicking", async () => {
  const big = Array.from({ length: 300 }, (_, i) => mkp(i + 1, { car: i % 12 === 0, team: ["A", "B", "C", "D", "E"][i % 5], lang: ["DE", "EN", "RU"][i % 3], legs: [true, i % 7 !== 0] }));
  const t0 = Date.now();
  await fresh(1440, 900, false, baseDoc(big));
  const loadMs = Date.now() - t0;
  const total = (await counts()).reduce((a, b) => a + b, 0);
  eq("300 people: all are placed on leg 1", total, 300);
  check(`300 people: the page is ready in a reasonable time (${loadMs} ms incl. reload)`, loadMs < 9000);
  const t1 = Date.now(); await click(legBtn(2), 50);
  const legMs = Date.now() - t1;
  eq("300 people: leg 2 has the 257 people who join", (await counts()).reduce((a, b) => a + b, 0), 300 - big.filter((p) => !p.legs[1]).length);
  check(`300 people: switching the leg is fast (${legMs} ms)`, legMs < 3000);
  await click(groupBtn("Team"));
  check("300 people: grouping works", (await state()).groupBy === "team");
  const t2 = Date.now(); await click(nth(".bar-leg > .btn-grad", 0), 100);
  await wait(500); let file = null;
  for (let i = 0; i < 40 && !file; i++) { await wait(500); file = await lastBlobFile("big.xlsx"); }
  check(`300 people: Excel export finishes (${Date.now() - t2} ms)`, !!file && Date.now() - t2 < 25000);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  eq("300 people: Personen sheet has 300 rows + header, messages likewise", [wb.getWorksheet("Personen").rowCount, wb.getWorksheet("Nachrichten").rowCount], [301, 301]);
  await setFile(".bar-plan input[type=file]", file);
  eq("300 people: the file loads back", await peopleTitle(), "Personen (300)");
  // fast clicking
  await fresh();
  for (let i = 0; i < 12; i++) await click(countBtn("car", false), 0);
  for (let i = 0; i < 12; i++) await click(countBtn("car", true), 0);
  await wait(400);
  eq("12 fast clicks down and up: the sum is still 40", (await counts()).reduce((a, b) => a + b, 0), 40);
  for (let i = 0; i < 15; i++) await click(restBtn(i % 2 ? "Tram" : "Taxi"), 0);
  await wait(300);
  eq("fast switching between tram and taxi keeps everybody", (await counts()).reduce((a, b) => a + b, 0), 40);
});

await run("26 · Excel files saved by Excel (time values, case, spaces, extras)", async () => {
  await fresh();
  await click(nth(".bar-leg > .btn-grad", 0), 3500);
  const orig = await lastBlobFile("excel-src.xlsx");
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(orig);
  const ps = wb.getWorksheet("Personen");
  const rowOf = (name) => { let r = null; ps.eachRow((row, n) => { if (n > 1 && String(row.getCell(1).value) === name) r = n; }); return r; };
  // 1) Excel stores a typed "14:40" as a time value (a fraction of a day) and sometimes as a date
  const dana = rowOf("Dana Beispiel"); ps.getCell(dana, 7).value = " taxi 1 "; ps.getCell(dana, 8).value = null; ps.getCell(dana, 9).value = 14 / 24 + 40 / 1440;
  const eli = rowOf("Eli Beispiel"); ps.getCell(eli, 7).value = "TAXI 1"; ps.getCell(eli, 8).value = null; ps.getCell(eli, 9).value = new Date(Date.UTC(1899, 11, 30, 14, 40));
  // 2) "Ja" instead of the check mark, seats as text, a person with a car typed by hand
  const finn = rowOf("Finn Beispiel"); ps.getCell(finn, 4).value = "Ja"; ps.getCell(finn, 5).value = "4";
  // 3) a blank line in the middle and a trailing blank row
  ps.getCell(ps.rowCount + 2, 1).value = "Nach Leerzeile";
  // 4) the same name twice
  ps.getCell(ps.rowCount + 1, 1).value = "Alex Beispiel";
  // 5) an unknown label
  const bea = rowOf("Bea Beispiel"); ps.getCell(bea, 7).value = "Hubschrauber 7";
  const f = path.join(TMP, "excel-edited.xlsx"); await wb.xlsx.writeFile(f);
  await setFile(".bar-plan input[type=file]", f);
  const people = await peopleTitle();
  check("the file loads (blank line skipped, duplicate name kept as a second person)", people === "Personen (42)", people);
  const a = await assignment();
  eq("' taxi 1 ' and 'TAXI 1' in any case / with spaces are understood", [a["Dana Beispiel"], a["Eli Beispiel"]], ["Taxi 1", "Taxi 1"]);
  eq("time as an Excel time value or date -> 14:40", await ev(`${nth("#taxi .time-input", 0)}.value`), "14:40");
  eq("'Ja' + seats '4' make Finn a driver with 4 seats", await ev(`(() => { const r = [...${$$(".tbl tbody tr")}].find(x => x.children[1].textContent === 'Finn Beispiel'); return r.querySelector('.chip').classList.contains('on') + ' ' + r.querySelector('.mini').textContent.trim(); })()`), "true 4 Plätze");
  check("an unknown label ('Hubschrauber 7') does not break anything: the person is placed by the app", !!a["Bea Beispiel"] && a["Bea Beispiel"] !== "nicht dabei", a["Bea Beispiel"]);
  // a CSV that a German Excel saved as "CSV" (windows-1252, not UTF-8), and one saved as "CSV UTF-8" (with BOM)
  const ansi = path.join(TMP, "ansi.csv");
  fs.writeFileSync(ansi, Buffer.from("Name;Auto;Plätze\nMüller, Jörg;ja;5\nGroß;nein;\nÄrztin Özdemir;nein;\n", "latin1"));
  await setFile(".roster-tools input[type=file]", ansi);
  eq("ANSI CSV: umlauts and ß come out right", await ev(`[...${$$(".tbl tbody tr")}].map(r => r.children[1].textContent)`), ["Müller, Jörg", "Groß", "Ärztin Özdemir"]);
  const utf = path.join(TMP, "utf8bom.csv");
  fs.writeFileSync(utf, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Name;Auto;Plätze\nMüller, Jörg;ja;5\nGroß;nein;\nÖzlem Çelik Привет;nein;\n", "utf8")]));
  await setFile(".roster-tools input[type=file]", utf);
  eq("UTF-8 CSV with BOM: umlauts, Turkish and Cyrillic letters come out right", await ev(`[...${$$(".tbl tbody tr")}].map(r => r.children[1].textContent)`), ["Müller, Jörg", "Groß", "Özlem Çelik Привет"]);
  check("no script errors", jsErrors().length === 0, jsErrors().join(" | "));
});

await run("27 · keyboard and screen reader basics", async () => {
  await fresh();
  // seats: Tab / Enter / Space
  const a = await seatName("c1:1"), b = await seatName("c2:1");
  await ev(`${SEATS("c1:1")}.focus()`); await enter();
  check("Enter selects the focused seat", (await count(".is-picked")) === 1);
  await ev(`${SEATS("c2:1")}.focus()`); await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 }); await wait(300);
  eq("Space on the second seat swaps the two", [await seatName("c1:1"), await seatName("c2:1")], [b, a]);
  await ev(`${SEATS("c1:1")}.focus()`); await enter(); await escape();
  eq("Esc cancels a selection", await count(".is-picked"), 0);
  // buttons that only show an icon have a name
  const unnamed = async () => ev(`(() => { const out = []; const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || e.getAttribute('placeholder') || (e.id && document.querySelector('label[for="' + e.id + '"]')?.textContent) || '').trim(); [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button], [role=switch]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.getAttribute('aria-hidden') !== 'true'; }).forEach(e => { if (!name(e)) out.push(e.tagName + '.' + e.className); }); return out; })()`);
  eq("every visible control on the page has a name", await unnamed(), []);
  await click($(".rules-open"), 400);
  await choose(`${$(".modal .add-rule")}`, "Zwei Personen");
  eq("every control in the rules popup has a name", await unnamed(), []);
  await escape();
  await click($(".cp-layout-btn"));
  eq("every control of the layout bar has a name", await unnamed(), []);
  await click($(".lb-done"));
  await viewport(390, 844, true); await wait(400);
  await click($(".cp-menu-btn"), 700);
  eq("every control of the side menu has a name", await unnamed(), []);
  await click($(".drawer-head .icon-btn"), 500);
  check("images have alt text", (await ev(`[...document.images].filter(i => !i.hasAttribute('alt')).length`)) === 0);
  check("the page language is set", ["de", "en"].includes(await ev("document.documentElement.lang")));
  check("dialogs are announced as dialogs (rules popup, side menu)", await (async () => { await click($(".rules-open"), 400); const a = await ev(`${$(".modal")}.getAttribute('role') + ${$(".modal")}.getAttribute('aria-modal')`); await escape(); await click($(".cp-menu-btn"), 700); const b = await ev(`${$(".drawer")}.getAttribute('role') + ${$(".drawer")}.getAttribute('aria-modal')`); await click($(".drawer-head .icon-btn"), 500); return a === "dialogtrue" && b === "dialogtrue"; })());
});

await run("28 · touch (a phone with real touch events)", async () => {
  await fresh(390, 844, true);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await ev("window.__x = 1");
  const a = await seatName("c1:1"), b = await seatName("c2:1");
  await tap(SEATS("c1:1"));
  check("a tap selects a passenger and shows the cancel bar", (await count(".is-picked")) === 1 && (await exists(".pick-bar")));
  await tap(SEATS("c2:1"));
  eq("a second tap swaps the two", [await seatName("c1:1"), await seatName("c2:1")], [b, a]);
  await tap(SEATS("c1:1")); await tap($(".pick-bar button"));
  eq("the 'Abbrechen' button of the bar cancels", await count(".is-picked"), 0);
  // scrolling over the seats must not select anything
  const y0 = await ev("scrollY");
  await swipe(SEATS("c3:1"), -260);
  check("scrolling by touch over a seat scrolls the page and selects nothing", (await ev("scrollY")) !== y0 && (await count(".is-picked")) === 0, `y ${y0} -> ${await ev("scrollY")}`);
  // side menu by touch
  await tap($(".cp-menu-btn"), 700);
  check("a tap opens the side menu", await exists(".drawer"));
  await tap($(".drawer .cp-lang button:nth-child(2)"), 400);
  eq("touch on the language buttons", await ev("document.documentElement.lang"), "en");
  await tap($(".drawer .cp-lang button:nth-child(1)"), 400);
  await tap(startsWith(".drawer-links a", "ÖPNV"), 1600);
  check("a tap on a menu link scrolls to the section", !(await exists(".drawer")) && Math.abs((await ev(`${$("#tram")}.getBoundingClientRect().top`)) - 92) <= 1);
  // time field and dropdown by touch
  await tap(nth("#tram .time-input", 0), 300);
  check("a tap in the time field focuses it (numeric keyboard on a phone)", (await ev("document.activeElement.className")).includes("time-input") && (await ev("document.activeElement.inputMode")) === "numeric");
  await ev("document.activeElement.blur()");
  check("phone: all person cards start folded", (await count(".tbl tbody tr.folded")) === 40);
  await tap(nth(".tbl tbody tr", 0) + ".querySelector('.fold-btn')", 600);
  check("the arrow opens one card", (await count(".tbl tbody tr.folded")) === 39);
  check("the arrow is labelled in the page language (German)", /Zuklappen/.test(await ev(`${nth(".tbl tbody tr", 0)}.querySelector('.fold-btn').getAttribute('aria-label')`)));
  await tap(nth(".tbl tbody tr", 0) + `.querySelectorAll('.select__trigger')[0]`, 400);
  check("a dropdown opens by touch", (await menuItems()).length === 6);
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
});

await run("29 · other languages and time zones of the computer", async () => {
  for (const [locale, tz] of [["tr-TR", "Europe/Istanbul"], ["en-US", "America/Los_Angeles"], ["ja-JP", "Asia/Tokyo"]]) {
    await send("Emulation.setLocaleOverride", { locale }).catch(() => {});
    await send("Emulation.setTimezoneOverride", { timezoneId: tz }).catch(() => {});
    await fresh();
    const hero = await text(".holo-facts");
    check(`${locale} / ${tz}: the event date stays 27. November 2026 and the page works`, /27\. November 2026/.test(hero) && (await counts()).join() === "20,20,0", hero.slice(0, 60));
    eq(`${locale}: the departure time field is 24 h text (not the browser's 12 h field)`, [await ev(`${nth("#cars .time-input", 0)}.type`), await ev(`${nth("#cars .time-input", 0)}.value`)], ["text", "15:00"]);
    await click(nth(".bar-leg > .btn-grad", 0), 3500);
    const f = await lastBlobFile(`loc-${locale}.xlsx`);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f);
    check(`${locale}: Excel export shows the date 27.11.2026 and 15:00`, /27\.11\.2026/.test(String(wb.getWorksheet("Übersicht").getCell("A1").value)) && wb.getWorksheet("Übersicht").getRow(4).getCell(2).value === "15:00");
  }
  await send("Emulation.setLocaleOverride", {}).catch(() => {});
  await send("Emulation.setTimezoneOverride", { timezoneId: "" }).catch(() => {});
});

await run("29b · name box (search + add), bell, Russian, loading screen", async () => {
  await fresh();
  const box = $(".add-form input");
  const setSearch = async (txt) => {
    await click(box, 120);
    await ev(`${box}.select()`);
    if (txt) await send("Input.insertText", { text: txt });
    else { await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); }
    await wait(300);
  };
  const names = () => ev(`[...${$$(".tbl tbody tr")}].map(r => r.children[1].textContent)`);
  check("the name box says it searches and adds", /suchen/.test(await ev(`${box}.placeholder`)));
  await setSearch("alex");
  const hit = await names();
  check("typing filters the list by name", hit.length >= 1 && hit.length < 40 && hit.every((n) => /alex/i.test(n)), hit.join(","));
  await setSearch("zzzz");
  check("no match: empty list and a hint that Hinzufügen creates the person", (await count(".tbl tbody tr")) === 0 && /Niemand mit/.test(await ev("document.querySelector('#all').innerText")));
  await click(`${$(".add-form .ghost")}`);
  check("Hinzufügen adds a person with the typed name and clears the box", (await peopleTitle()) === "Personen (41)" && (await ev(`${box}.value`)) === "" );
  check("the new person is in the list under that name", (await names()).includes("zzzz"));
  // bell
  await fresh();
  check("bell: no number while there is nothing to flag", (await exists(".cp-bell")) && (await count(".cp-bell b")) === 0);
  await click($(".cp-bell"), 900);
  const top = await ev(`${$("#checks")}.getBoundingClientRect().top`);
  check("bell: jumps to the checks section", top > 60 && top < 120, "top " + top);
  // Russian
  await click($(".cp-nav .cp-lang button:nth-child(3)"), 500);
  check("RU: page language, headings and date", (await ev("document.documentElement.lang")) === "ru" && /Поездки на авто/.test(await text("#cars .tile-title")) && /ноября 2026/.test(await text(".holo-facts")));
  check("RU: no German or English left in the main headings", !/[A-Za-z]{4,}/.test((await text("#cars .tile-title")) + (await text("#tram .tile-title")) + (await text("#taxi .tile-title")) + (await text("#checks .tile-title"))));
  await click($(".cp-nav .cp-lang button:nth-child(1)"), 400);
  eq("back to German", await ev("document.documentElement.lang"), "de");
  // loading screen: shows up, then goes away by itself; ?nosplash skips it
  await send("Page.navigate", { url: URL_.replace("?nosplash", "") });
  await wait(700);
  check("loading screen is shown on a normal visit", await exists(".cp-splash"));
  await wait(7500);
  check("and leaves by itself", !(await exists(".cp-splash")));
  await send("Page.navigate", { url: URL_ });
  await wait(900);
  check("?nosplash skips it", !(await exists(".cp-splash")));
});

await run("30 · console", async () => {
  const real = pageErrors.filter((e) => !/no people sheet|no persons/.test(e)); // loading a foreign Excel file logs on purpose
  check("no script errors or console errors during the whole run", real.length === 0, real.slice(0, 3).join(" | "));
});

// ---------- summary ----------
console.log(`\n==== ${results.pass} passed, ${results.fail} failed ====`);
results.failures.forEach((f) => console.log("  ✗ " + f));
ws.close();
chrome.kill();
// the test files (Excel / CSV / JSON samples, browser profile) stay in the system temp folder: TMP
console.log(`temp files: ${TMP}`);
process.exit(results.fail ? 1 : 0);
