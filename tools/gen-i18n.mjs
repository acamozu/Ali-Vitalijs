// Builds webapp/i18n/i18n*.properties and webapp/model/text.js from the texts of the web version
// (Ali-Vitalijs-event-agenda/src/carpool/text.js + textRu.js), so the two versions say the same.
// Run from the project folder:  node tools/gen-i18n.mjs      then:  npm test
//
// Plain texts become one key each ("carsH", "xl.title", "rules.0"). Texts that depend on values become
// patterns with {0}, {1} ...; where the wording changes with a number or a choice there is one key per form
// ("tickets.one" / "tickets.other", "chk.emptyBox.group" / "chk.emptyBox.taxi").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = process.env.CARPOOL_WEB || path.resolve(HERE, "../../../../Ali-Vitalijs-event-agenda/src/carpool");
const OUT = path.resolve(HERE, "../webapp");
const { TEXT } = await import(pathToFileURL(path.join(WEB, "text.js")).href);
const LANGS = ["de", "en", "ru"];

// texts only the Fiori version needs (plan kept in the SAP system)
const EXTRA = {
	de: {
		appTitle: "Transfer-Planer", appDescription: "Year-End Conference 2026",
		"x.loading": "Plan wird geladen …", "x.saving": "Speichert …", "x.saved": "Gespeichert", "x.saved.at": "Gespeichert · {0}",
		"x.savedTitle": "Im SAP-System gespeichert", "x.savedTitle.by": "Im SAP-System gespeichert – zuletzt von {0}", "x.savedTitle.byAt": "Im SAP-System gespeichert – zuletzt von {0}, {1}",
		"x.unsaved": "Nicht gespeichert", "x.local": "Nur in diesem Browser", "x.localTitle": "Der SAP-Service ist nicht erreichbar. Der Plan bleibt in diesem Browser gespeichert.",
		"x.error": "Speichern fehlgeschlagen – erneut versuchen", "x.conflictH": "Der Plan wurde inzwischen geändert", "x.someone": "Jemand",
		"x.conflictText": "{0} hat den Plan gespeichert. Den neuen Stand laden oder mit dem eigenen überschreiben?",
		"x.conflictText.at": "{0} hat den Plan um {1} gespeichert. Den neuen Stand laden oder mit dem eigenen überschreiben?",
		"x.conflictReload": "Neuen Stand laden", "x.conflictOverwrite": "Überschreiben",
	},
	en: {
		appTitle: "Transfer Planner", appDescription: "Year-End Conference 2026",
		"x.loading": "Loading the plan …", "x.saving": "Saving …", "x.saved": "Saved", "x.saved.at": "Saved · {0}",
		"x.savedTitle": "Saved in the SAP system", "x.savedTitle.by": "Saved in the SAP system – last by {0}", "x.savedTitle.byAt": "Saved in the SAP system – last by {0}, {1}",
		"x.unsaved": "Not saved", "x.local": "In this browser only", "x.localTitle": "The SAP service cannot be reached. The plan stays saved in this browser.",
		"x.error": "Saving failed – try again", "x.conflictH": "The plan was changed in the meantime", "x.someone": "Someone",
		"x.conflictText": "{0} saved the plan. Load the new version or overwrite it with yours?",
		"x.conflictText.at": "{0} saved the plan at {1}. Load the new version or overwrite it with yours?",
		"x.conflictReload": "Load new version", "x.conflictOverwrite": "Overwrite",
	},
	ru: {
		appTitle: "Планировщик трансферов", appDescription: "Year-End Conference 2026",
		"x.loading": "План загружается …", "x.saving": "Сохранение …", "x.saved": "Сохранено", "x.saved.at": "Сохранено · {0}",
		"x.savedTitle": "Сохранено в системе SAP", "x.savedTitle.by": "Сохранено в системе SAP – последним: {0}", "x.savedTitle.byAt": "Сохранено в системе SAP – последним: {0}, {1}",
		"x.unsaved": "Не сохранено", "x.local": "Только в этом браузере", "x.localTitle": "Сервис SAP недоступен. План остаётся сохранённым в этом браузере.",
		"x.error": "Не удалось сохранить – повторить", "x.conflictH": "План был изменён", "x.someone": "Кто-то",
		"x.conflictText": "{0} сохранил(а) план. Загрузить новую версию или перезаписать своей?",
		"x.conflictText.at": "{0} сохранил(а) план в {1}. Загрузить новую версию или перезаписать своей?",
		"x.conflictReload": "Загрузить новую версию", "x.conflictOverwrite": "Перезаписать",
	},
};

const RULES = ["noTaxi", "noTram", "inCar", "notAlone"];
const one = (s, ph) => { // the form for exactly 1: put the placeholder where the 1 stands
	if (!/(^|[^0-9{])1([^0-9}]|$)/.test(s)) throw new Error("no 1 in: " + s);
	return s.replace(/(^|[^0-9{])1([^0-9}]|$)/, `$1${ph}$2`);
};

// patterns of the texts that are functions in the web version
function patterns(t) {
	const p = {};
	for (const k of ["tramSub", "noMatch", "removeAsk", "replaceAsk", "darkH", "variantDeleteAsk"]) p[k] = t[k]("{0}");
	p["tickets.one"] = one(t.tickets(1), "{0}");
	p["tickets.other"] = t.tickets("{0}");
	const c = t.chk;
	p["chk.noPeople"] = c.noPeople();
	p["chk.rule.pair.together"] = c.rule({ type: "pair", mode: "together", a: "{0}", b: "{1}" });
	p["chk.rule.pair.apart"] = c.rule({ type: "pair", mode: "apart", a: "{0}", b: "{1}" });
	p["chk.rule.lang"] = c.rule({ type: "lang", bad: "{0}", total: "{1}", lang: "{2}" });
	p["chk.rule.teamMax.one.all"] = one(c.rule({ type: "teamMax", bad: "{0}", max: 1, team: "*" }), "{1}");
	p["chk.rule.teamMax.one.team"] = one(c.rule({ type: "teamMax", bad: "{0}", max: 1, team: "{2}" }), "{1}");
	p["chk.rule.teamMax.other.all"] = c.rule({ type: "teamMax", bad: "{0}", max: "{1}", team: "*" });
	p["chk.rule.teamMax.other.team"] = c.rule({ type: "teamMax", bad: "{0}", max: "{1}", team: "{2}" });
	const note = c.rule({ type: "note", keyword: "{0}", names: "{1}", rule: "?" }); // "...: undefined."
	if (note.split("undefined").length !== 2) throw new Error("note pattern: " + note);
	const [head, tail] = note.split("undefined");
	p["chk.rule.note"] = head + "{2}" + tail;
	for (const r of RULES) {
		const full = c.rule({ type: "note", keyword: "{0}", names: "{1}", rule: r });
		p["chk.rule.note." + r] = full.slice(head.length, full.length - tail.length);
		p["chk.rule.person." + r] = c.rule({ type: "person", name: "{0}", rule: r });
	}
	p["chk.emptyCar"] = c.emptyCar({ n: "{0}" });
	p["chk.freeSeats"] = c.freeSeats({ free: "{0}", others: "{1}" });
	p["chk.smallGroup.one"] = one(c.smallGroup({ n: "{0}", size: 1 }), "{1}");
	p["chk.smallGroup.other"] = c.smallGroup({ n: "{0}", size: "{1}" });
	p["chk.lonelyTaxi"] = c.lonelyTaxi({ n: "{0}" });
	p["chk.emptyBox.group"] = c.emptyBox({ kind: "group", n: "{0}" });
	p["chk.emptyBox.taxi"] = c.emptyBox({ kind: "taxi", n: "{0}" });
	p["chk.mixed"] = c.mixed({ count: "{0}", total: "{1}", by: "k" }, { k: "{2}" });
	p["chk.carNotThere"] = c.carNotThere({ name: "{0}" });
	return p;
}

// SHAPE: the keys of TEXT[lang] in their order; [name] text, [name, n] list, [name, [sub keys]] group, [name, "f"] built in text.js
const shape = [];
const flat = { de: {}, en: {}, ru: {} };
for (const [k, v] of Object.entries(TEXT.de)) {
	if (typeof v === "string") { shape.push([k]); for (const l of LANGS) flat[l][k] = TEXT[l][k]; }
	else if (Array.isArray(v)) { shape.push([k, v.length]); for (const l of LANGS) TEXT[l][k].forEach((s, i) => (flat[l][`${k}.${i}`] = s)); }
	else if (typeof v === "function" || k === "chk") shape.push([k, "f"]);
	else { shape.push([k, Object.keys(v)]); for (const l of LANGS) for (const s of Object.keys(v)) flat[l][`${k}.${s}`] = TEXT[l][k][s]; }
}
for (const l of LANGS) {
	if (JSON.stringify(Object.keys(TEXT[l]).sort()) !== JSON.stringify(Object.keys(TEXT.de).sort())) throw new Error(l + ": other keys than de"); // the order may differ
	Object.assign(flat[l], patterns(TEXT[l]));
}

// .properties: ASCII only (\uXXXX), so the files survive every editor, upload and build setting
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/^ /, "\\ ").replace(/[^\x20-\x7e]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));
const NAMES = { de: "German", en: "English", ru: "Russian" };
function file(l) {
	const lines = [`# Transfer planner (carpool) - ${NAMES[l]}. Generated by tools/gen-i18n.mjs from the texts of the web version;`, "# letters outside ASCII are written as \\uXXXX. {0}, {1} ... are filled in by model/text.js.", ""];
	lines.push("# --- app (Launchpad tile, loading screen)", `appTitle=${esc(EXTRA[l].appTitle)}`, `appDescription=${esc(EXTRA[l].appDescription)}`, "", "# --- page");
	let chk = false;
	for (const [k, v] of Object.entries(flat[l])) {
		if (k.startsWith("chk.") && !chk) { chk = true; lines.push("", "# --- hints of the plan check"); }
		lines.push(`${k}=${esc(v)}`);
	}
	lines.push("", "# --- saving in the SAP system (Fiori version only)");
	for (const [k, v] of Object.entries(EXTRA[l])) if (k.startsWith("x.")) lines.push(`${k}=${esc(v)}`);
	return lines.join("\n") + "\n";
}
fs.mkdirSync(path.join(OUT, "i18n"), { recursive: true });
fs.writeFileSync(path.join(OUT, "i18n", "i18n.properties"), file("de")); // fallback = German
for (const l of LANGS) fs.writeFileSync(path.join(OUT, "i18n", `i18n_${l}.properties`), file(l));

// model/text.js: SHAPE is generated, the rest is the fixed part below
const TEMPLATE = fs.readFileSync(path.join(HERE, "text.template.js"), "utf8");
const shapeSrc = "[\n" + shape.map((e) => "\t\t" + JSON.stringify(e).replace(/,/g, ", ")).join(",\n") + "\n\t]";
if (!TEMPLATE.includes("/*SHAPE*/[]")) throw new Error("text.template.js: marker missing");
fs.writeFileSync(path.join(OUT, "model", "text.js"), TEMPLATE.replace("/*SHAPE*/[]", shapeSrc));
console.log(`written: 4 i18n files (${Object.keys(flat.de).length + Object.keys(EXTRA.de).length} keys each), model/text.js (${shape.length} entries)`);
