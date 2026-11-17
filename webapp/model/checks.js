sap.ui.define(["./planner"], function (Planner) {
	"use strict";

	var MIN_TICKET_GROUP = Planner.MIN_TICKET_GROUP;
	var tagOf = Planner.tagOf;

	// custom rules the user adds by hand (saved with the plan):
	//   { id, type, level: "warn" | "info", on, ...params }
	//   pair     { a, b, mode: "together" | "apart" }       two people
	//   lang     { lang }                                    every vehicle needs at least one person with this language
	//   teamMax  { team: "*" | name, max }                   at most `max` people of one team per vehicle
	//   person   { p, rule: "noTaxi" | "noTram" | "inCar" | "notAlone" }  a restriction for one person
	//   note     { keyword, rule }                           the same restriction for everybody whose note contains the keyword
	var RULE_TYPES = ["pair", "lang", "teamMax", "person", "note"];

	function newRule(type) {
		var base = { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, level: "warn", on: true };
		if (type === "pair") {
			return Object.assign(base, { a: "", b: "", mode: "together" });
		}
		if (type === "lang") {
			return Object.assign(base, { lang: "DE" });
		}
		if (type === "teamMax") {
			return Object.assign(base, { team: "*", max: 2 });
		}
		if (type === "note") {
			return Object.assign(base, { keyword: "", rule: "noTram" });
		}
		return Object.assign(base, { p: "", rule: "noTaxi" });
	}

	// a rule counts (in the checks and in the button) only when it is switched on and all its fields are filled in
	function ruleReady(r) {
		if (!r.on) {
			return false;
		}
		if (r.type === "pair") {
			return !!r.a && !!r.b && r.a !== r.b;
		}
		if (r.type === "lang") {
			return !!r.lang;
		}
		if (r.type === "teamMax") {
			return !!r.team && r.max >= 1;
		}
		if (r.type === "person") {
			return !!r.p && !!r.rule;
		}
		if (r.type === "note") {
			return !!String(r.keyword || "").trim() && !!r.rule;
		}
		return false;
	}

	// keeps only rules of a known shape (saved files / old data)
	function cleanRules(list) {
		if (!Array.isArray(list)) {
			return [];
		}
		return list
			.filter(function (r) {
				return r && r.id && RULE_TYPES.includes(r.type);
			})
			.map(function (r) {
				return Object.assign(newRule(r.type), r, { level: r.level === "info" ? "info" : "warn", on: r.on !== false, id: String(r.id) });
			})
			.map(function (r) {
				return r.type === "pair" && r.a && r.a === r.b ? Object.assign({}, r, { b: "" }) : r;
			});
	}

	// does the place of a person break this restriction?
	function breaks(rule, w, alone) {
		return rule === "noTaxi" ? w.kind === "taxi" : rule === "noTram" ? w.kind === "group" : rule === "notAlone" ? alone : w.kind !== "car";
	}

	// plan checks per leg. Each hint: { level: "warn" | "info", leg, code, args }
	function computeChecks(opts) {
		var persons = opts.persons;
		var layouts = opts.layouts;
		var groupBy = opts.groupBy;
		var limits = opts.limits;
		var rules = opts.rules === undefined ? [] : opts.rules;
		var out = [];
		var byId = Object.fromEntries(persons.map(function (p) {
			return [p.id, p];
		}));
		var minGroup = Math.min(MIN_TICKET_GROUP, limits.groupMax);
		layouts.forEach(function (entry, leg) {
			var l = entry.layout;
			var add = function (level, code, args) {
				out.push({ level: level, leg: leg, code: code, args: args === undefined ? {} : args });
			};
			var size = function (id) {
				return l.boxes[id].filter(Boolean).length;
			};
			var active = persons.filter(function (p) {
				return p.legs[leg];
			}).length;
			if (!active) {
				add("warn", "noPeople");
				return;
			}

			var carFree = l.order.cars.reduce(function (n, id) {
				return n + l.boxes[id].length - size(id);
			}, 0);
			var onFoot = l.order.groups.reduce(function (n, id) {
				return n + size(id);
			}, 0) + l.order.taxis.reduce(function (n, id) {
				return n + size(id);
			}, 0);
			l.order.cars.forEach(function (id, n) {
				if (size(id) === 1 && onFoot > 0) {
					add("warn", "emptyCar", { n: n + 1 });
				}
			});
			if (carFree > 0 && onFoot > 0) {
				add("info", "freeSeats", { free: carFree, others: onFoot });
			}

			l.order.groups.forEach(function (id, n) {
				var s = size(id);
				if (s === 0) {
					add("info", "emptyBox", { kind: "group", n: n + 1 });
				} else if (s < minGroup) {
					add("warn", "smallGroup", { n: n + 1, size: s });
				}
			});
			var taxiFree = l.order.taxis.reduce(function (n, id) {
				return n + l.boxes[id].length - size(id);
			}, 0);
			l.order.taxis.forEach(function (id, n) {
				var s = size(id);
				if (s === 0) {
					add("info", "emptyBox", { kind: "taxi", n: n + 1 });
				} else if (s === 1 && taxiFree - (l.boxes[id].length - 1) >= 1) {
					add("warn", "lonelyTaxi", { n: n + 1 });
				}
			});

			if (groupBy !== "none") {
				// one line per leg: how many cars / groups / taxis are not uniform
				var ids = l.order.cars.concat(l.order.groups, l.order.taxis).filter(function (id) {
					return size(id) > 0;
				});
				var mixed = ids.filter(function (id) {
					return new Set(l.boxes[id].filter(Boolean).map(function (pid) {
						return tagOf(byId[pid], groupBy) || "–";
					})).size > 1;
				}).length;
				if (mixed) {
					add("info", "mixed", { count: mixed, total: ids.length, by: groupBy });
				}
			}

			// the car has to be at the start of the second leg
			if (leg === 1) {
				persons.filter(function (p) {
					return p.car && p.legs[1] && !p.legs[0];
				}).forEach(function (p) {
					add("warn", "carNotThere", { name: p.name });
				});
			}

			// ---------- custom rules ----------
			var where = {}; // person id -> { id: box id, kind: "car" | "group" | "taxi" }
			var kindOf = { c: "car", g: "group", t: "taxi" };
			Object.entries(l.boxes).forEach(function (box) {
				var id = box[0];
				box[1].forEach(function (pid) {
					if (pid) {
						where[pid] = { id: id, kind: kindOf[id[0]] };
					}
				});
			});
			var filled = Object.entries(l.boxes).filter(function (box) {
				return box[1].some(Boolean);
			});
			rules
				.filter(ruleReady)
				.forEach(function (r) {
					var rule = function (args) {
						add(r.level, "rule", Object.assign({ type: r.type }, args));
					};
					var bad, w;
					if (r.type === "pair") {
						var wa = where[r.a];
						var wb = where[r.b];
						if (!r.a || !r.b || r.a === r.b || !wa || !wb) {
							return; // incomplete, or one of them is not on this leg
						}
						var same = wa.id === wb.id;
						if (r.mode === "together" ? !same : same) {
							rule({ a: byId[r.a].name, b: byId[r.b].name, mode: r.mode });
						}
					} else if (r.type === "lang") {
						bad = filled.filter(function (box) {
							return !box[1].some(function (pid) {
								return pid && byId[pid].lang === r.lang;
							});
						}).length;
						if (bad) {
							rule({ lang: r.lang, bad: bad, total: filled.length });
						}
					} else if (r.type === "teamMax") {
						bad = filled.filter(function (box) {
							var count = {};
							box[1].forEach(function (pid) {
								var t = pid && byId[pid].team;
								if (t && (r.team === "*" || t === r.team)) {
									count[t] = (count[t] || 0) + 1;
								}
							});
							return Object.values(count).some(function (n) {
								return n > r.max;
							});
						}).length;
						if (bad) {
							rule({ team: r.team, max: r.max, bad: bad });
						}
					} else if (r.type === "person") {
						w = where[r.p];
						if (!r.p || !w) {
							return;
						}
						var alone = l.boxes[w.id].filter(Boolean).length === 1; // the only person of their car / group / taxi
						if (breaks(r.rule, w, alone)) {
							rule({ name: byId[r.p].name, rule: r.rule, kind: w.kind });
						}
					} else if (r.type === "note") {
						var kw = r.keyword.trim().toLowerCase();
						var hits = [];
						persons.forEach(function (p) {
							var pw = where[p.id];
							if (!pw || !p.legs[leg] || !p.note || !p.note.toLowerCase().includes(kw)) {
								return;
							}
							if (breaks(r.rule, pw, l.boxes[pw.id].filter(Boolean).length === 1)) {
								hits.push({ name: p.name, kind: pw.kind });
							}
						});
						if (hits.length) {
							rule({
								keyword: r.keyword.trim(),
								rule: r.rule,
								names: hits.map(function (h) {
									return h.name;
								}).join(", "),
								count: hits.length,
								kind: hits[0].kind
							});
						}
					}
				});
		});
		return out;
	}

	return {
		RULE_TYPES: RULE_TYPES,
		newRule: newRule,
		ruleReady: ruleReady,
		cleanRules: cleanRules,
		computeChecks: computeChecks
	};
});
