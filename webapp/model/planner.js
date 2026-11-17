// Roster + transfer planner. Everything runs in the browser, nothing is sent anywhere.
// Test names are fictional until HR loads the real list (CSV).
sap.ui.define([], function () {
	"use strict";

	var EVENT = {
		title: "Year-End Conference",
		company: "alseda Consulting",
		date: "2026-11-27",
		tz: "+01:00",
		venue: "JW Marriott, Salon I",
		address: "Thurn-und-Taxis-Platz 2, 60313 Frankfurt"
	};

	var CAR_SEATS = 5; // driver included
	var MIN_SEATS = 2; // e.g. a cabrio
	var GROUP_TICKET_MAX = 5; // RMV group day ticket: up to 5 people
	var TAXI_SEATS = 4;
	var MIN_TICKET_GROUP = 3; // a rest of 1-2 people takes a taxi instead of a group ticket

	// the two transfers of the day, taken from the live agenda
	// (the React app derives them from the agenda items; here the resulting values are fixed)
	var LEGS = [
		{
			time: "15:00",
			from: { name: { de: "JW Marriott", en: "JW Marriott", ru: "JW Marriott" }, addr: EVENT.address },
			to: { name: { de: "Altes Polizeipräsidium", en: "Old Police Headquarters", ru: "Старое полицейское управление" }, addr: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main" }
		},
		{
			time: "18:00",
			from: { name: { de: "Altes Polizeipräsidium", en: "Old Police Headquarters", ru: "Старое полицейское управление" }, addr: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main" },
			to: { name: { de: "Casa Isoletta", en: "Casa Isoletta", ru: "Casa Isoletta" }, addr: "Babenhäuser Landstraße 1, 60599 Frankfurt am Main" }
		}
	];

	var FIRST = ["Alex", "Bea", "Chris", "Dana", "Eli", "Finn", "Gina", "Hugo"];
	var LAST = ["Beispiel", "Muster", "Probe", "Demo", "Testmann"];
	// 40 fictional names
	var NAMES = LAST.flatMap(function (l) {
		return FIRST.map(function (f) {
			return f + " " + l;
		});
	});

	function newPerson(name, extra) {
		if (extra === undefined) {
			extra = {};
		}
		return Object.assign(
			{ id: "P" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, car: false, seats: CAR_SEATS, legs: [true, true], team: "", lang: "", note: "" },
			extra
		);
	}

	// next free fictional name
	function nextName(persons) {
		var used = new Set(persons.map(function (p) {
			return p.name;
		}));
		return NAMES.find(function (n) {
			return !used.has(n);
		}) || "Person " + (persons.length + 1);
	}

	// 40 test persons, 4 of them bring a car (alternating positions so the cars are spread over the list)
	var TEAMS = ["SAP PE", "TRBK", "Marketing", "Projektleitung", "Finance"];
	// the three languages of the team
	var LANG_OPTIONS = ["DE", "EN", "RU"];
	var LANG_WORDS = { "de": "DE", "deutsch": "DE", "german": "DE", "en": "EN", "englisch": "EN", "english": "EN", "ru": "RU", "russisch": "RU", "russian": "RU", "русский": "RU" };
	function normLang(v) {
		return LANG_WORDS[String(v || "").trim().toLowerCase()] || "";
	}
	var LANGS = ["DE", "DE", "EN", "RU", "DE", "EN", "DE", "RU", "DE", "DE"];
	function defaultPersons() {
		return NAMES.map(function (name, i) {
			return {
				id: "P" + String(i + 1).padStart(2, "0"),
				name: name,
				car: i % 10 === 0,
				seats: CAR_SEATS,
				legs: [true, true],
				team: TEAMS[(i * 3 + Math.floor(i / 5)) % TEAMS.length],
				lang: LANGS[(i * 7 + 3) % LANGS.length],
				note: i === 4 ? "Rollstuhl" : i === 11 ? "Gepäck" : ""
			};
		});
	}

	// what "belongs together" when grouping: the team or the spoken language
	function tagOf(p, by) {
		return (by === "team" ? p.team : by === "lang" ? p.lang : "") || "";
	}

	// plan one transfer: drivers take passengers (balanced), the rest goes by tram groups or by taxi
	var DEFAULT_LIMITS = { groupMax: GROUP_TICKET_MAX, taxiSeats: TAXI_SEATS };
	var LIMIT_RANGE = [2, 8]; // people per group ticket
	var TAXI_RANGE = [2, 4]; // a taxi takes 4 at most

	function planLeg(persons, leg, restBy, limits, groupBy) {
		if (restBy === undefined) {
			restBy = "tram";
		}
		if (limits === undefined) {
			limits = DEFAULT_LIMITS;
		}
		if (groupBy === undefined) {
			groupBy = "none";
		}
		var groupMax = limits.groupMax;
		var taxiSeats = limits.taxiSeats;
		var minGroup = Math.min(MIN_TICKET_GROUP, groupMax);
		var active = persons.filter(function (p) {
			return p.legs[leg];
		});
		var drivers = active.filter(function (p) {
			return p.car;
		});
		var riders = active.filter(function (p) {
			return !p.car;
		});
		// people with the same team / language sit next to each other, so cars and groups fill with them first
		if (groupBy !== "none") {
			riders = riders
				.map(function (p, i) {
					return { p: p, i: i };
				})
				.sort(function (a, b) {
					var x = tagOf(a.p, groupBy) || "￿";
					var y = tagOf(b.p, groupBy) || "￿";
					return x < y ? -1 : x > y ? 1 : a.i - b.i;
				})
				.map(function (o) {
					return o.p;
				});
		}

		var cars = drivers.map(function (d, i) {
			return { id: i + 1, driver: d, seats: d.seats, passengers: [] };
		});
		var rest = [];
		riders.forEach(function (p) {
			var open = cars.filter(function (c) {
				return c.passengers.length + 1 < c.seats;
			});
			if (!open.length) {
				rest.push(p);
				return;
			}
			// even loads; with grouping the car whose driver / passengers share the tag wins
			var tag = tagOf(p, groupBy);
			var score = function (c) {
				return groupBy === "none" || !tag
					? 0
					: (tagOf(c.driver, groupBy) === tag ? 3 : 0) + c.passengers.filter(function (q) {
						return tagOf(q, groupBy) === tag;
					}).length;
			};
			var best = open.reduce(function (m, c) {
				var d = score(c) - score(m);
				return d > 0 || (d === 0 && c.passengers.length < m.passengers.length) ? c : m;
			});
			best.passengers.push(p);
		});

		var tram = [];
		var taxiList = [];
		var i;
		if (restBy === "tram") {
			for (i = 0; i < rest.length; i += groupMax) {
				tram.push(rest.slice(i, i + groupMax));
			}
			if (tram.length && tram[tram.length - 1].length < minGroup) {
				taxiList = tram.pop();
			}
		} else {
			taxiList = rest;
		}
		var tramGroups = tram.map(function (members, n) {
			return { id: n + 1, buyer: members[0], members: members };
		});
		var taxis = [];
		for (i = 0; i < taxiList.length; i += taxiSeats) {
			taxis.push({ id: taxis.length + 1, members: taxiList.slice(i, i + taxiSeats) });
		}

		return {
			cars: cars,
			tramGroups: tramGroups,
			taxis: taxis,
			away: persons.length - active.length,
			count: {
				car: cars.reduce(function (n, c) {
					return n + 1 + c.passengers.length;
				}, 0),
				tram: tramGroups.reduce(function (n, g) {
					return n + g.members.length;
				}, 0),
				taxi: taxis.reduce(function (n, t) {
					return n + t.members.length;
				}, 0)
			}
		};
	}

	// ---------- editable layout of one leg ----------
	// boxes: { c1: [driverId, passengerId|null, ...], g1: [id|null x groupMax], t1: [id|null x taxiSeats] }
	// order: box ids per kind (labels are numbered by position), buyers: group id -> person who buys the ticket
	function pad(list, n) {
		var a = list.slice(0, n);
		while (a.length < n) {
			a.push(null);
		}
		return a;
	}

	function idOf(p) {
		return p.id;
	}

	function baseLayout(plan, limits) {
		if (limits === undefined) {
			limits = DEFAULT_LIMITS;
		}
		var boxes = {};
		var order = { cars: [], groups: [], taxis: [] };
		var buyers = {};
		plan.cars.forEach(function (c, i) {
			var id = "c" + (i + 1);
			boxes[id] = pad([c.driver.id].concat(c.passengers.map(idOf)), c.seats);
			order.cars.push(id);
		});
		plan.tramGroups.forEach(function (g, i) {
			var id = "g" + (i + 1);
			boxes[id] = pad(g.members.map(idOf), limits.groupMax);
			buyers[id] = g.buyer.id;
			order.groups.push(id);
		});
		plan.taxis.forEach(function (x, i) {
			var id = "t" + (i + 1);
			boxes[id] = pad(x.members.map(idOf), limits.taxiSeats);
			order.taxis.push(id);
		});
		return { boxes: boxes, order: order, buyers: buyers, times: {} };
	}

	// every non-empty group needs a valid ticket buyer
	function fixBuyers(layout) {
		var buyers = {};
		layout.order.groups.forEach(function (g) {
			var members = layout.boxes[g].filter(Boolean);
			if (members.length) {
				buyers[g] = members.includes(layout.buyers[g]) ? layout.buyers[g] : members[0];
			}
		});
		return Object.assign({}, layout, { buyers: buyers });
	}

	function newBoxId(layout, prefix) {
		var used = Object.keys(layout.boxes)
			.filter(function (k) {
				return k[0] === prefix;
			})
			.map(function (k) {
				return +k.slice(1);
			});
		return prefix + (Math.max.apply(Math, [0].concat(used)) + 1);
	}

	// set how many people go by car / tram / taxi (sum stays the same). People keep their place where possible:
	// the last ones of a mode that shrinks move over to the mode that grows.
	function applyCounts(l, target, limits) {
		var carSlots = [];
		l.order.cars.forEach(function (id) {
			l.boxes[id].forEach(function (_, i) {
				if (i > 0) {
					carSlots.push([id, i]);
				}
			});
		});
		var riders = carSlots.filter(function (s) {
			return l.boxes[s[0]][s[1]];
		});
		var group = l.order.groups.flatMap(function (g) {
			return l.boxes[g].filter(Boolean);
		});
		var taxi = l.order.taxis.flatMap(function (g) {
			return l.boxes[g].filter(Boolean);
		});
		var carNow = riders.length + l.order.cars.length;
		var pool = [];
		var carDelta = target.car - carNow;
		var k;
		var slot;
		for (k = 0; k < -carDelta; k++) {
			slot = riders[riders.length - 1 - k];
			pool.push(l.boxes[slot[0]][slot[1]]);
			l.boxes[slot[0]][slot[1]] = null;
		}
		if (group.length > target.tram) {
			Array.prototype.push.apply(pool, group.splice(target.tram));
		}
		if (taxi.length > target.taxi) {
			Array.prototype.push.apply(pool, taxi.splice(target.taxi));
		}
		if (carDelta > 0) {
			var open = carSlots.filter(function (s) {
				return !l.boxes[s[0]][s[1]];
			});
			for (k = 0; k < carDelta && k < open.length && pool.length; k++) {
				l.boxes[open[k][0]][open[k][1]] = pool.shift();
			}
		}
		if (group.length < target.tram) {
			Array.prototype.push.apply(group, pool.splice(0, target.tram - group.length));
		}
		if (taxi.length < target.taxi) {
			Array.prototype.push.apply(taxi, pool.splice(0, target.taxi - taxi.length));
		}

		// refill the groups / taxis in order with their new members; unused boxes disappear
		var refill = function (kind, prefix, list, size) {
			var need = Math.ceil(list.length / size);
			var ids = l.order[kind].slice(0, need);
			l.order[kind].slice(need).forEach(function (id) {
				delete l.boxes[id];
			});
			while (ids.length < need) {
				ids.push(newBoxId({
					boxes: Object.assign({}, l.boxes, Object.fromEntries(ids.map(function (i) {
						return [i, 0];
					})))
				}, prefix));
			}
			l.order[kind] = ids;
			ids.forEach(function (id, n) {
				l.boxes[id] = pad(list.slice(n * size, (n + 1) * size), size);
			});
		};
		refill("groups", "g", group, limits.groupMax);
		refill("taxis", "t", taxi, limits.taxiSeats);
		return l;
	}

	// the layout of another leg as a start for leg `to`: same cars, groups and taxis; people who are not on `to` drop out
	// (the app fills their places again), drivers who are only on `to` get an empty car, departure times start again
	function copyLayoutToLeg(src, persons, to) {
		var byId = Object.fromEntries(persons.map(function (p) {
			return [p.id, p];
		}));
		var boxes = {};
		var order = { cars: [], groups: src.order.groups.slice(), taxis: src.order.taxis.slice() };
		src.order.cars.forEach(function (id) {
			var d = byId[src.boxes[id][0]];
			if (d && d.car && d.legs[to]) {
				boxes[id] = src.boxes[id].slice();
				order.cars.push(id);
			}
		});
		order.groups.concat(order.taxis).forEach(function (id) {
			boxes[id] = src.boxes[id].slice();
		});
		var next = { boxes: boxes, order: order, buyers: Object.assign({}, src.buyers), times: {} };
		persons
			.filter(function (p) {
				return p.car && p.legs[to] && !order.cars.some(function (id) {
					return boxes[id][0] === p.id;
				});
			})
			.forEach(function (p) {
				var id = newBoxId(next, "c");
				boxes[id] = pad([p.id], p.seats);
				order.cars.push(id);
			});
		return fixBuyers(next);
	}

	// bring a stored (manually edited) layout in line with the current roster and limits:
	// people who left are removed, new people take the first free place, sizes follow the limits
	function reconcileLayout(layout, riderIds, limits, restBy) {
		var riders = new Set(riderIds);
		var boxes = {};
		var order = { cars: layout.order.cars.slice(), groups: layout.order.groups.slice(), taxis: layout.order.taxis.slice() };
		var size = function (id) {
			return id[0] === "g" ? limits.groupMax : id[0] === "t" ? limits.taxiSeats : layout.boxes[id].length;
		};
		var kept = new Set();
		Object.entries(layout.boxes).forEach(function (entry) {
			var id = entry[0];
			var slots = entry[1];
			var car = id[0] === "c";
			var list = slots.map(function (x, i) {
				if (car && i === 0) {
					return x; // the driver is part of the structure
				}
				if (x && riders.has(x) && !kept.has(x)) {
					kept.add(x);
					return x;
				}
				return null;
			});
			if (!car && list.length > size(id)) {
				list = list.filter(Boolean);
			}
			boxes[id] = car ? list : pad(list, size(id));
		});
		// whoever lost a place by shrinking a group or taxi is placed again below
		var seen = new Set(Object.entries(boxes).flatMap(function (entry) {
			var id = entry[0];
			return entry[1].filter(function (x, i) {
				return x && !(id[0] === "c" && i === 0);
			});
		}));
		var times = Object.fromEntries(Object.entries(layout.times || {}).filter(function (entry) {
			return entry[0] in boxes;
		}));
		var next = { boxes: boxes, order: order, buyers: Object.assign({}, layout.buyers), times: times };
		var free = function (kinds) {
			var a, b, k, id, i;
			var notDriver = function (x, j) {
				return x === null && !(k === "cars" && j === 0);
			};
			for (a = 0; a < kinds.length; a++) {
				k = kinds[a];
				for (b = 0; b < order[k].length; b++) {
					id = order[k][b];
					i = boxes[id].findIndex(notDriver);
					if (i !== -1) {
						return [id, i];
					}
				}
			}
			return null;
		};
		var pref = restBy === "taxi" ? ["cars", "taxis", "groups"] : ["cars", "groups", "taxis"];
		riderIds
			.filter(function (id) {
				return !seen.has(id);
			})
			.forEach(function (id) {
				var spot = free(pref);
				if (!spot) {
					var kind = restBy === "taxi" ? "taxis" : "groups";
					var nid = newBoxId(next, kind === "taxis" ? "t" : "g");
					boxes[nid] = pad([], kind === "taxis" ? limits.taxiSeats : limits.groupMax);
					order[kind].push(nid);
					spot = [nid, 0];
				}
				boxes[spot[0]][spot[1]] = id;
			});
		return fixBuyers(next);
	}

	// ---------- CSV (Excel in Germany saves with ";") ----------
	var YES = /^(1|x|j|ja|y|yes|true|wahr|evet|да|auto|car|авто)$/i;
	var NO = /^(0|n|nein|no|false|falsch|hayir|hayır|-)$/i;

	function notBlank(x) {
		return x.trim();
	}

	function splitCsv(text) {
		var clean = text.replace(/^﻿/, "");
		var first = clean.split(/\r?\n/)[0] || "";
		var delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
		var rows = [];
		var row = [];
		var cell = "";
		var q = false;
		var i, c;
		for (i = 0; i < clean.length; i++) {
			c = clean[i];
			if (q) {
				if (c === '"' && clean[i + 1] === '"') {
					cell += '"';
					i++;
				} else if (c === '"') {
					q = false;
				} else {
					cell += c;
				}
			} else if (c === '"') {
				q = true;
			} else if (c === delim) {
				row.push(cell);
				cell = "";
			} else if (c === "\n" || c === "\r") {
				if (c === "\r" && clean[i + 1] === "\n") {
					i++;
				}
				row.push(cell);
				cell = "";
				if (row.some(notBlank)) {
					rows.push(row);
				}
				row = [];
			} else {
				cell += c;
			}
		}
		row.push(cell);
		if (row.some(notBlank)) {
			rows.push(row);
		}
		return rows;
	}

	// columns: name; car (ja/nein); seats; leg 1 (ja/nein); leg 2 (ja/nein). Only the name is required; header row is optional.
	function parseRoster(text) {
		var rows = splitCsv(text);
		if (rows.length && /name/i.test(rows[0][0] || "")) {
			rows.shift();
		}
		var out = [];
		var flag = function (v) {
			return !NO.test((v || "").trim());
		};
		rows.forEach(function (r, i) {
			var name = (r[0] || "").trim();
			if (!name) {
				return;
			}
			var car = YES.test((r[1] || "").trim());
			var seats = Math.min(CAR_SEATS, Math.max(MIN_SEATS, parseInt(r[2], 10) || CAR_SEATS));
			out.push({ id: "I" + String(i + 1).padStart(3, "0"), name: name, car: car, seats: seats, legs: [flag(r[3]), flag(r[4])], team: (r[5] || "").trim(), lang: normLang(r[6]), note: (r[7] || "").trim() });
		});
		return out;
	}

	function exportCsv(rows) {
		var esc = function (v) {
			return '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
		};
		return "﻿" + rows.map(function (r) {
			return r.map(esc).join(";");
		}).join("\r\n");
	}

	return {
		EVENT: EVENT,
		CAR_SEATS: CAR_SEATS,
		MIN_SEATS: MIN_SEATS,
		GROUP_TICKET_MAX: GROUP_TICKET_MAX,
		TAXI_SEATS: TAXI_SEATS,
		MIN_TICKET_GROUP: MIN_TICKET_GROUP,
		LEGS: LEGS,
		newPerson: newPerson,
		nextName: nextName,
		LANG_OPTIONS: LANG_OPTIONS,
		normLang: normLang,
		defaultPersons: defaultPersons,
		tagOf: tagOf,
		DEFAULT_LIMITS: DEFAULT_LIMITS,
		LIMIT_RANGE: LIMIT_RANGE,
		TAXI_RANGE: TAXI_RANGE,
		planLeg: planLeg,
		baseLayout: baseLayout,
		fixBuyers: fixBuyers,
		newBoxId: newBoxId,
		applyCounts: applyCounts,
		copyLayoutToLeg: copyLayoutToLeg,
		reconcileLayout: reconcileLayout,
		parseRoster: parseRoster,
		exportCsv: exportCsv
	};
});
