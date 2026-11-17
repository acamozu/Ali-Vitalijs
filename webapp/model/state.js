sap.ui.define(["./planner", "./checks"], function (Planner, Checks) {
	"use strict";

	var LIMIT_RANGE = Planner.LIMIT_RANGE;
	var defaultPersons = Planner.defaultPersons;
	var normLang = Planner.normLang;
	var DEFAULT_LIMITS = Planner.DEFAULT_LIMITS;
	var TAXI_RANGE = Planner.TAXI_RANGE;
	var cleanRules = Checks.cleanRules;

	var STORE = "carpool-v3";

	var LANGS = ["de", "en", "ru"];

	// the language to start with: query parameter `lang`, then the one stored in this browser, else German
	function initialLang() {
		var q = new URLSearchParams(window.location.search).get("lang");
		if (LANGS.includes(q)) {
			return q;
		}
		try {
			var s = localStorage.getItem("carpool-lang");
			if (LANGS.includes(s)) {
				return s;
			}
		} catch (e) {
			// no storage: fall through to the default
		}
		return "de";
	}

	// roster, chosen leg, rest mode and manual seat edits stay in this browser
	function loadState() {
		try {
			var s = JSON.parse(localStorage.getItem(STORE));
			if (s && Array.isArray(s.persons) && s.persons.every(function (p) {
				return p && p.id && p.name && Array.isArray(p.legs);
			})) {
				return s;
			}
		} catch (e) {
			// nothing usable stored
		}
		return null;
	}

	// what forces a fresh plan: the leg, how the rest travels, and who drives how many seats.
	// Everything else (people joining or leaving, group sizes) is merged into the manually edited layout.
	function structKeyOf(persons, leg, restBy, groupBy) {
		return leg + "|" + restBy + "|" + groupBy + "|" + persons.filter(function (p) {
			return p.legs[leg] && p.car;
		}).map(function (p) {
			return p.id + ":" + p.seats;
		}).join(",");
	}

	function isDriverPos(pos) {
		return pos.car[0] === "c" && pos.idx === 0;
	}

	function clampLimit(v, d, range) {
		if (range === undefined) {
			range = LIMIT_RANGE;
		}
		return Number.isInteger(v) && v >= range[0] && v <= range[1] ? v : d;
	}

	// ---------- section order + saved variants (a view preference: kept in localStorage, not part of the plan / undo) ----------
	// the hero stays on top and rules / closing tile / footer stay at the bottom; these sections can be moved
	var SECTION_KEYS = ["leg", "plan", "counts", "checks", "cars", "tram", "taxi", "people", "cards"];

	var LAYOUT_STORE = "carpool-layouts-v1";

	function normOrder(o) {
		var seen = new Set();
		var list = (Array.isArray(o) ? o : []).filter(function (k) {
			return SECTION_KEYS.includes(k) && !seen.has(k) && seen.add(k);
		});
		return list.concat(SECTION_KEYS.filter(function (k) {
			return !seen.has(k);
		}));
	}

	function sameOrder(a, b) {
		return a.length === b.length && a.every(function (k, i) {
			return k === b[i];
		});
	}

	function loadLayouts() {
		try {
			var s = JSON.parse(localStorage.getItem(LAYOUT_STORE));
			if (s) {
				var variants = (Array.isArray(s.variants) ? s.variants : [])
					.filter(function (v) {
						return v && v.id && typeof v.name === "string";
					})
					.map(function (v) {
						return { id: String(v.id), name: v.name, order: normOrder(v.order) };
					});
				return {
					variants: variants,
					activeId: variants.some(function (v) {
						return v.id === s.activeId;
					}) ? s.activeId : null,
					order: normOrder(s.order)
				};
			}
		} catch (e) {
			// nothing usable stored
		}
		return { variants: [], activeId: null, order: SECTION_KEYS };
	}

	// everything that is saved and can be undone lives in one document
	// an older saved test list (4 teams) gets the current test teams; lists with own teams are left alone
	function refreshTestTeams(persons) {
		var demo = new Map(defaultPersons().map(function (p) {
			return [p.id, p];
		}));
		var isDemo = function (p) {
			return demo.has(p.id) && demo.get(p.id).name === p.name;
		};
		var old = new Set(["", "SAP PE", "TRBK", "Marketing", "Projektleitung"]);
		var mine = persons.filter(isDemo);
		if (!mine.length || !mine.every(function (p) {
			return old.has(p.team);
		})) {
			return persons;
		}
		return persons.map(function (p) {
			return isDemo(p) ? Object.assign({}, p, { team: demo.get(p.id).team, lang: p.lang || demo.get(p.id).lang }) : p;
		});
	}

	function initialDoc(saved) {
		// `saved` may be missing (first start) and so may its limits
		var has = saved !== null && saved !== undefined;
		var limits = has ? saved.limits : undefined;
		var hasLimits = limits !== null && limits !== undefined;
		var groupBy = has ? saved.groupBy : undefined;
		return {
			persons: refreshTestTeams(((has ? saved.persons : undefined) || defaultPersons()).map(function (p) {
				return Object.assign({ team: "", note: "" }, p, { lang: normLang(p.lang) });
			})),
			restBy: (has ? saved.restBy : undefined) === "taxi" ? "taxi" : "tram",
			groupBy: ["team", "lang"].includes(groupBy) ? groupBy : "none",
			limits: {
				groupMax: clampLimit(hasLimits ? limits.groupMax : undefined, DEFAULT_LIMITS.groupMax),
				taxiSeats: clampLimit(hasLimits ? limits.taxiSeats : undefined, DEFAULT_LIMITS.taxiSeats, TAXI_RANGE)
			},
			edits: (has ? saved.edits : undefined) || {}, // { [leg]: { key, layout } }
			rules: cleanRules(has ? saved.rules : undefined) // custom checks, saved with the plan
		};
	}

	function docReducer(state, a) {
		var keep = 60;
		if (a.type === "undo") {
			if (!state.past.length) {
				return state;
			}
			return { doc: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.doc].concat(state.future) };
		}
		if (a.type === "redo") {
			if (!state.future.length) {
				return state;
			}
			return { doc: state.future[0], past: state.past.concat([state.doc]), future: state.future.slice(1) };
		}
		var next = a.fn(state.doc);
		if (next === state.doc) {
			return state;
		}
		return { doc: next, past: state.past.slice(-(keep - 1)).concat([state.doc]), future: [] };
	}

	return {
		STORE: STORE,
		LANGS: LANGS,
		initialLang: initialLang,
		loadState: loadState,
		structKeyOf: structKeyOf,
		isDriverPos: isDriverPos,
		clampLimit: clampLimit,
		SECTION_KEYS: SECTION_KEYS,
		LAYOUT_STORE: LAYOUT_STORE,
		normOrder: normOrder,
		sameOrder: sameOrder,
		loadLayouts: loadLayouts,
		refreshTestTeams: refreshTestTeams,
		initialDoc: initialDoc,
		docReducer: docReducer
	};
});
