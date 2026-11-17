// Compares the SAPUI5 port of the text module with the original React module.
// Run: node --test projects/carpoolfiori_/test/text.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = "c:/Users/Mitarbeiter/Desktop/claude_abap/Ali-Vitalijs-event-agenda/src/carpool";
const PORT_FILE = path.join(here, "..", "webapp", "model", "text.js");

const orig = await import(pathToFileURL(path.join(SRC_DIR, "text.js")).href);
const origRu = await import(pathToFileURL(path.join(SRC_DIR, "textRu.js")).href);

// the port takes its texts from webapp/i18n/i18n_<lang>.properties (test/amd.mjs reads them from disk)
const { load, readProperties } = await import("./amd.mjs");
const port = load("text");
const I18N_DIR = path.join(here, "..", "webapp", "i18n");

const NAMES = ["Anna", "Jörg Müller", "Олег", "", "O'Neil & Söhne"];
const NUMS = [0, 1, 2, 5];
const KINDS_BY = ["car", "group", "taxi", "team", "lang"];
const PERSON_RULES = ["noTaxi", "noTram", "inCar", "notAlone", "unknown"];

// argument sets per function, keyed by the path below TEXT[lang]
function argSets(key, kinds) {
	const sets = [];
	switch (key) {
		case "tramSub":
			["Hotel Lindner", "Hauptbahnhof", ""].forEach((v) => sets.push([v]));
			break;
		case "tickets":
		case "replaceAsk":
		case "darkH":
			NUMS.concat([11, 21, "3"]).forEach((v) => sets.push([v]));
			break;
		case "noMatch":
		case "removeAsk":
		case "variantDeleteAsk":
			NAMES.forEach((v) => sets.push([v]));
			break;
		case "chk.noPeople":
			sets.push([], [{}], [{}, kinds]);
			break;
		case "chk.rule":
			for (const mode of ["together", "apart"]) {
				sets.push([{ type: "pair", mode, a: "Anna", b: "Jörg Müller" }, kinds]);
			}
			for (const bad of NUMS) {
				sets.push([{ type: "lang", bad, total: 5, lang: "Русский" }, kinds]);
				for (const max of NUMS) {
					for (const team of ["*", "SAP Basis", ""]) {
						sets.push([{ type: "teamMax", bad, max, team }, kinds]);
					}
				}
			}
			for (const rule of PERSON_RULES) {
				sets.push([{ type: "note", keyword: "Rollstuhl", names: "Anna, Олег", rule }, kinds]);
				sets.push([{ type: "person", name: "Jörg Müller", rule }, kinds]);
			}
			// one args object carrying every field, per type, plus an unknown type
			for (const type of ["pair", "lang", "teamMax", "note", "person", "nope"]) {
				sets.push([{ type, mode: "together", a: "A", b: "B", bad: 2, total: 5, lang: "de", max: 1, team: "*", keyword: "k", names: "n", rule: "inCar", name: "N" }, kinds]);
			}
			break;
		case "chk.emptyCar":
		case "chk.lonelyTaxi":
			NUMS.forEach((n) => sets.push([{ n }, kinds]));
			break;
		case "chk.freeSeats":
			NUMS.forEach((free) => NUMS.forEach((others) => sets.push([{ free, others }, kinds])));
			break;
		case "chk.smallGroup":
			NUMS.forEach((n) => NUMS.forEach((size) => sets.push([{ n, size }, kinds])));
			break;
		case "chk.emptyBox":
			["group", "taxi", "other"].forEach((kind) => NUMS.forEach((n) => sets.push([{ kind, n }, kinds])));
			break;
		case "chk.mixed":
			KINDS_BY.concat(["unknown"]).forEach((by) => NUMS.forEach((count) => sets.push([{ count, total: 5, by }, kinds])));
			break;
		case "chk.carNotThere":
			NAMES.forEach((name) => sets.push([{ name }, kinds]));
			break;
		default:
			return null;
	}
	return sets;
}

let fnCount = 0;
let callCount = 0;
let leafCount = 0;

function walk(a, b, where, rel, kindsA, kindsB) {
	if (typeof a === "function") {
		assert.equal(typeof b, "function", where + ": port is not a function");
		assert.equal(b.length, a.length, where + ": arity differs");
		const sets = argSets(rel, kindsA);
		assert.ok(sets && sets.length, where + ": no argument sets defined for this function");
		fnCount++;
		for (const args of sets) {
			// the port gets its own kinds object, the original gets the original one
			const argsB = args.map((x) => (x === kindsA ? kindsB : x));
			const ra = a(...args);
			const rb = b(...argsB);
			callCount++;
			assert.strictEqual(rb, ra, where + " with " + JSON.stringify(args[0]));
		}
		return;
	}
	if (Array.isArray(a)) {
		assert.ok(Array.isArray(b), where + ": port is not an array");
		assert.equal(b.length, a.length, where + ": array length differs");
		a.forEach((v, i) => walk(v, b[i], where + "[" + i + "]", rel + "[" + i + "]", kindsA, kindsB));
		return;
	}
	if (a && typeof a === "object") {
		assert.ok(b && typeof b === "object" && !Array.isArray(b), where + ": port is not an object");
		assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), where + ": key sets differ");
		for (const k of Object.keys(a)) {
			walk(a[k], b[k], where + "." + k, rel ? rel + "." + k : k, kindsA, kindsB);
		}
		return;
	}
	leafCount++;
	assert.strictEqual(typeof b, typeof a, where + ": type differs");
	assert.strictEqual(b, a, where + ": value differs");
}

test("port exports the same names as the original", () => {
	assert.deepEqual(Object.keys(port).sort(), ["EXTRA", "LANGS", "TEXT", "load", "use"]);
	assert.deepEqual(Object.keys(port.TEXT), Object.keys(orig.TEXT));
	assert.deepEqual(Object.keys(orig.TEXT), ["de", "en", "ru"]);
	assert.strictEqual(orig.TEXT.ru, origRu.ru);
});

for (const lang of Object.keys(orig.TEXT)) {
	test("TEXT." + lang + " is identical (keys, values, function results)", () => {
		const before = { fnCount, callCount, leafCount };
		walk(orig.TEXT[lang], port.TEXT[lang], "TEXT." + lang, "", orig.TEXT[lang].kinds, port.TEXT[lang].kinds);
		console.log(
			"TEXT." + lang + ": " + (leafCount - before.leafCount) + " leaves, " + (fnCount - before.fnCount) + " functions, " + (callCount - before.callCount) + " calls compared"
		);
	});
}

test("all three languages have the same key set", () => {
	const keys = (o) => Object.keys(o).sort();
	for (const lang of ["en", "ru"]) {
		assert.deepEqual(keys(port.TEXT[lang]), keys(port.TEXT.de), lang);
		assert.deepEqual(keys(port.TEXT[lang].chk), keys(port.TEXT.de.chk), lang + ".chk");
	}
});

test("the i18n files: same keys in every language, ASCII only, fallback = German", () => {
	const de = readProperties("de");
	for (const lang of ["en", "ru"]) {
		assert.deepEqual(Object.keys(readProperties(lang)), Object.keys(de), lang);
	}
	for (const name of ["i18n", "i18n_de", "i18n_en", "i18n_ru"]) {
		const raw = readFileSync(path.join(I18N_DIR, name + ".properties"), "utf8");
		assert.equal(/[^\x00-\x7f]/.test(raw), false, name + ": letters outside ASCII must be written as \\uXXXX");
	}
	assert.equal(readFileSync(path.join(I18N_DIR, "i18n.properties"), "utf8"), readFileSync(path.join(I18N_DIR, "i18n_de.properties"), "utf8"));
});

test("no text of the page is a bare key (a key missing in the files would show as itself)", () => {
	const bare = [];
	for (const lang of ["de", "en", "ru"]) {
		const file = readProperties(lang);
		// key = the path below TEXT[lang] ("xl.title", "rules.0"); the text may only equal its key if the file says so
		const scan = (v, key) => {
			if (typeof v === "string") {
				if (v === key && file[key] !== v) bare.push(lang + ": " + key);
			} else if (v && typeof v === "object") {
				for (const k of Object.keys(v)) scan(v[k], key ? key + "." + k : k);
			}
		};
		scan(port.TEXT[lang], "");
		scan(port.EXTRA[lang], "x");
	}
	assert.deepEqual(bare, []);
});

test("texts of the Fiori version (saving in the SAP system)", () => {
	const x = port.EXTRA.de;
	assert.equal(x.saved(""), "Gespeichert");
	assert.equal(x.saved("14:05"), "Gespeichert \u00B7 14:05");
	assert.equal(x.savedTitle("", ""), "Im SAP-System gespeichert");
	assert.equal(x.savedTitle("DEV001", ""), "Im SAP-System gespeichert \u2013 zuletzt von DEV001");
	assert.equal(x.savedTitle("DEV001", "14:05"), "Im SAP-System gespeichert \u2013 zuletzt von DEV001, 14:05");
	assert.equal(x.conflictText("", ""), "Jemand hat den Plan gespeichert. Den neuen Stand laden oder mit dem eigenen \u00FCberschreiben?");
	assert.equal(x.conflictText("DEV001", "14:05"), "DEV001 hat den Plan um 14:05 gespeichert. Den neuen Stand laden oder mit dem eigenen \u00FCberschreiben?");
	assert.equal(port.EXTRA.en.appTitle, "Transfer Planner");
	assert.equal(port.EXTRA.ru.conflictReload, "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E");
	for (const lang of ["de", "en", "ru"]) {
		for (const k of Object.keys(x)) assert.equal(typeof port.EXTRA[lang][k], typeof x[k], lang + "." + k);
	}
});
