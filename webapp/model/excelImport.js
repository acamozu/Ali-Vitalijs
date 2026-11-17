// Reads an exported (and maybe edited) plan back from Excel: the "Personen" / "People" sheet holds one row per person.
// columns: name, team, language, car, seats, then for every leg: leg time, assignment ("Auto 2", "Gruppe 1", "Taxi 3" or "nicht dabei"),
// role (driver / group ticket) and the departure time of the vehicle.
sap.ui.define(["./planner", "./text"], function (Planner, Text) {
	"use strict";

	var CAR_SEATS = Planner.CAR_SEATS;
	var MIN_SEATS = Planner.MIN_SEATS;
	var normLang = Planner.normLang;
	var TEXT = Text.TEXT;
	var EXCELJS_MODULE = "com/alseda/carpool/lib/exceljs.min.js";

	// the words of every interface language (de / en / ru), so a plan exported in one language can be read back in any
	var ALL = Object.keys(TEXT).map(function (k) {
		return TEXT[k];
	});
	var words = function (get) {
		var out = [];
		ALL.forEach(function (t) {
			var w = get(t).toLowerCase();
			if (out.indexOf(w) === -1) {
				out.push(w);
			}
		});
		return out;
	};
	var SHEETS = words(function (t) {
		return t.xl.people;
	}).concat("personen", "people");
	var AWAY = words(function (t) {
		return t.notThere;
	}).concat("nicht dabei", "not joining", "–", "-");
	var KINDS = {};
	ALL.forEach(function (t) {
		KINDS[t.car.toLowerCase()] = "car";
		KINDS[t.group.toLowerCase()] = "group";
		KINDS[t.taxi.toLowerCase()] = "taxi";
	});
	KINDS.auto = "car";
	KINDS.car = "car";
	KINDS.gruppe = "group";
	KINDS.group = "group";
	KINDS.taxi = "taxi";
	var DRIVER = words(function (t) {
		return t.driver;
	}).concat("driver");
	var BUYER = words(function (t) {
		return t.buyer;
	}).concat("group ticket");
	var YES = ["✓", "x", "ja", "yes", "1", "true", "wahr", "evet", "да"];

	// exceljs (about 940 kB) is fetched on first use only: -> Promise for the global ExcelJS.
	// The bundle is a UMD build that starts with
	//   if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
	//   else if ("function" == typeof define && define.amd) define([], e);
	//   else window.ExcelJS = e();
	// so on a page that exposes a global AMD "define" (the UI5 loader does in some setups, sap.ui.define alone does not
	// count) it would register itself as an anonymous AMD module and never set the global. Therefore window.define is
	// hidden while the script tag loads and put back afterwards (on load and on error).
	var pExcelJS = null;
	function loadExcelJS() {
		if (window.ExcelJS) {
			return Promise.resolve(window.ExcelJS);
		}
		if (pExcelJS) {
			return pExcelJS;
		}
		pExcelJS = new Promise(function (resolve, reject) {
			var hadDefine = "define" in window;
			var savedDefine = window.define;
			var script = document.createElement("script");
			var restore = function () {
				if (hadDefine && window.define === undefined) {
					window.define = savedDefine;
				}
			};
			if (hadDefine) {
				window.define = undefined;
			}
			script.src = sap.ui.require.toUrl(EXCELJS_MODULE);
			script.async = true;
			script.onload = function () {
				restore();
				if (window.ExcelJS) {
					resolve(window.ExcelJS);
				} else {
					pExcelJS = null;
					reject(new Error("exceljs did not set the global ExcelJS"));
				}
			};
			script.onerror = function () {
				restore();
				pExcelJS = null; // the next attempt loads again
				if (script.parentNode) {
					script.parentNode.removeChild(script);
				}
				reject(new Error("exceljs could not be loaded"));
			};
			document.head.appendChild(script);
		});
		return pExcelJS;
	}

	var text = function (v) {
		if (v == null) {
			return "";
		}
		if (typeof v === "object") {
			if (v instanceof Date) {
				return "";
			}
			if (v.richText) {
				return v.richText
					.map(function (r) {
						return r.text;
					})
					.join("")
					.trim();
			}
			if ("result" in v) {
				return text(v.result);
			}
			if ("text" in v) {
				return String(v.text).trim();
			}
			return "";
		}
		return String(v).trim();
	};

	var two = function (n) {
		var s = String(n);
		return s.length < 2 ? "0" + s : s;
	};

	// "14:50", an Excel time (fraction of a day) or a date value -> "14:50"
	function clock(v) {
		var m;
		if (v instanceof Date) {
			return two(v.getUTCHours()) + ":" + two(v.getUTCMinutes());
		}
		if (typeof v === "number" && v >= 0 && v < 1) {
			m = Math.round(v * 1440);
			return two(Math.floor(m / 60) % 24) + ":" + two(m % 60);
		}
		m = /^(\d{1,2}):(\d{2})/.exec(text(v));
		return m ? two(+m[1]) + ":" + m[2] : "";
	}

	var pad = function (list, n) {
		var a = list.slice(0, n);
		while (a.length < n) {
			a.push(null);
		}
		return a;
	};

	// "X001", "X002", ...
	var personId = function (n) {
		var s = String(n);
		while (s.length < 3) {
			s = "0" + s;
		}
		return "X" + s;
	};

	// the bytes of the picked file (File / Blob)
	function bytesOf(file) {
		return file.arrayBuffer();
	}

	// the people sheet -> { persons, edits }
	function readSheet(wb, legs, limits, keyOf) {
		var ws = wb.worksheets.filter(function (s) {
			return SHEETS.indexOf(s.name.trim().toLowerCase()) !== -1;
		})[0];
		if (!ws) {
			throw new Error("no people sheet");
		}

		var persons = [];
		var rows = []; // the raw cells of every person, per leg: { label, role, depart }
		ws.eachRow(function (row, n) {
			if (n === 1) {
				return;
			}
			var name = text(row.getCell(1).value);
			if (!name) {
				return;
			}
			var car = YES.indexOf(text(row.getCell(4).value).toLowerCase()) !== -1;
			var seats = Math.min(CAR_SEATS, Math.max(MIN_SEATS, parseInt(text(row.getCell(5).value), 10) || CAR_SEATS));
			var cells = legs.map(function (_, l) {
				var base = 6 + l * 4;
				return { label: text(row.getCell(base + 1).value), role: text(row.getCell(base + 2).value).toLowerCase(), depart: clock(row.getCell(base + 3).value) };
			});
			persons.push({
				id: personId(persons.length + 1),
				name: name,
				car: car,
				seats: seats,
				legs: cells.map(function (c) {
					return AWAY.indexOf(c.label.toLowerCase()) === -1;
				}), // an empty assignment still means "joins"
				team: text(row.getCell(2).value),
				lang: normLang(text(row.getCell(3).value)),
				note: text(row.getCell(6 + legs.length * 4).value) // the note is the last column
			});
			rows.push(cells);
		});
		if (!persons.length) {
			throw new Error("no persons");
		}

		var edits = {};
		legs.forEach(function (lg, l) {
			var labelOf = function (i) {
				var m = /^([^\d]+?)\s*(\d+)$/.exec(rows[i][l].label);
				var kind = m && KINDS[m[1].trim().toLowerCase()];
				return kind ? { kind: kind, n: +m[2] } : null;
			};
			var boxes = {};
			var order = { cars: [], groups: [], taxis: [] };
			var buyers = {};
			var times = {};
			var depart = function (id, i) {
				var d = rows[i][l].depart;
				if (d && d !== lg.time && !times[id]) {
					times[id] = d;
				}
			};

			// every driver on this leg gets a car; riders go to the car whose number they carry
			var carByNumber = {};
			persons.forEach(function (p, i) {
				if (!p.car || !p.legs[l]) {
					return;
				}
				var id = "c" + (order.cars.length + 1);
				order.cars.push(id);
				boxes[id] = pad([p.id], p.seats);
				var lab = labelOf(i);
				if (lab && lab.kind === "car") {
					carByNumber[lab.n] = id;
				}
				depart(id, i);
			});
			// groups and taxis in the order of their numbers
			var make = function (kind, prefix, key, size) {
				var nums = [];
				persons.forEach(function (p, i) {
					var lab = p.legs[l] && !p.car ? labelOf(i) : null;
					if (lab && lab.kind === kind && nums.indexOf(lab.n) === -1) {
						nums.push(lab.n);
					}
				});
				nums.sort(function (a, b) {
					return a - b;
				});
				var ids = {};
				nums.forEach(function (n, k) {
					var id = prefix + (k + 1);
					ids[n] = id;
					order[key].push(id);
					boxes[id] = pad([], size);
				});
				return ids;
			};
			var groupIds = make("group", "g", "groups", limits.groupMax);
			var taxiIds = make("taxi", "t", "taxis", limits.taxiSeats);

			persons.forEach(function (p, i) {
				if (!p.legs[l] || p.car) {
					return;
				}
				var lab = labelOf(i);
				if (!lab) {
					return; // no assignment: the app places this person
				}
				var id = lab.kind === "car" ? carByNumber[lab.n] : lab.kind === "group" ? groupIds[lab.n] : taxiIds[lab.n];
				if (!id) {
					return;
				}
				var free = -1;
				boxes[id].some(function (x, k) {
					if (x === null && !(id.charAt(0) === "c" && k === 0)) {
						free = k;
						return true;
					}
					return false;
				});
				if (free === -1) {
					return; // the vehicle is full: the app places this person elsewhere
				}
				boxes[id][free] = p.id;
				if (lab.kind === "group" && BUYER.indexOf(rows[i][l].role) !== -1) {
					buyers[id] = p.id;
				}
				depart(id, i);
			});
			edits[l] = { key: keyOf(persons, l), layout: { boxes: boxes, order: order, buyers: buyers, times: times } };
		});
		return { persons: persons, edits: edits };
	}

	// file: File / Blob of the .xlsx, opts: { legs, limits: { groupMax, taxiSeats }, keyOf: function (persons, leg) }
	// -> Promise for { persons, edits }  (edits: { [leg]: { key, layout } })
	function readPlanFromExcel(file, opts) {
		var wb;
		return loadExcelJS()
			.then(function (ExcelJS) {
				wb = new ExcelJS.Workbook();
				return bytesOf(file);
			})
			.then(function (buffer) {
				return wb.xlsx.load(buffer);
			})
			.then(function () {
				return readSheet(wb, opts.legs, opts.limits, opts.keyOf);
			});
	}

	return { readPlanFromExcel: readPlanFromExcel };
});
