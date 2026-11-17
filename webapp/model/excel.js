// Excel export of the plan: overview, one sheet per leg (a coloured block per vehicle), a check-in list per leg,
// the people with filters (this sheet can be edited and loaded back), a message for every person, a cost sheet, the hints.
// exceljs is loaded only when the export is used.
sap.ui.define([], function () {
	"use strict";

	var SYMBOLIC_PRICES = { ticket: 30, taxi: 15 }; // example values in EUR, to be adjusted in the sheet

	var C = {
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
		input: "FFFFF3C4"
	};
	var KIND = { car: [C.car, C.carL], tram: [C.tram, C.tramL], taxi: [C.taxi, C.taxiL] };
	var fill = function (argb) {
		return { type: "pattern", pattern: "solid", fgColor: { argb: argb } };
	};
	var edge = { style: "thin", color: { argb: C.line } };
	var box = { top: edge, left: edge, bottom: edge, right: edge };
	var EURO = '#,##0.00 "€"';
	var EXCELJS_MODULE = "com/alseda/carpool/lib/exceljs.min.js";

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

	function styleCell(cell, o) {
		o = o || {};
		if (o.fill) {
			cell.fill = fill(o.fill);
		}
		cell.font = { name: "Calibri", size: o.size || 11, bold: !!o.bold, color: { argb: o.color || "FF111111" } };
		cell.alignment = { vertical: "middle", horizontal: o.align || "left", wrapText: !!o.wrap, indent: o.indent || 0 };
		if (o.border !== false) {
			cell.border = box;
		}
		if (o.numFmt) {
			cell.numFmt = o.numFmt;
		}
	}

	// a full-width coloured band (title / vehicle header)
	function band(ws, rowNo, cols, text, bg, o) {
		o = o || {};
		ws.mergeCells(rowNo, 1, rowNo, cols);
		var cell = ws.getCell(rowNo, 1);
		cell.value = text;
		styleCell(cell, { fill: bg, bold: true, size: o.size || 12, color: o.color, border: false, indent: 1 });
		ws.getRow(rowNo).height = o.height || 24;
	}

	// dark header row of a table
	function header(ws, rowNo, labels) {
		labels.forEach(function (l, i) {
			var c = ws.getCell(rowNo, i + 1);
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
			margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
		};
	}

	var first = function (name) {
		return String(name || "").split(" ")[0];
	};
	var AND = { de: "und", en: "and", ru: "и" };
	var joinList = function (arr, lang) {
		return arr.length < 2 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + AND[lang] + " " + arr[arr.length - 1];
	};
	var isSet = function (x) {
		return !!x;
	};

	// where a person sits on one leg: { kind, id, n, slots, driver } or null
	function findPlace(lay, p) {
		var n, id, i;
		for (n = 0; n < lay.order.cars.length; n++) {
			id = lay.order.cars[n];
			i = lay.boxes[id].indexOf(p.id);
			if (i !== -1) {
				return { kind: "car", id: id, n: n + 1, slots: lay.boxes[id], driver: i === 0 };
			}
		}
		for (n = 0; n < lay.order.groups.length; n++) {
			id = lay.order.groups[n];
			if (lay.boxes[id].indexOf(p.id) !== -1) {
				return { kind: "tram", id: id, n: n + 1, slots: lay.boxes[id] };
			}
		}
		for (n = 0; n < lay.order.taxis.length; n++) {
			id = lay.order.taxis[n];
			if (lay.boxes[id].indexOf(p.id) !== -1) {
				return { kind: "taxi", id: id, n: n + 1, slots: lay.boxes[id] };
			}
		}
		return null;
	}

	// the text for one person on one leg, ready to copy into a mail or chat
	// a: { p, l, lg, lay, byId, lang, t, time }
	function personMessage(a) {
		var p = a.p;
		var l = a.l;
		var lg = a.lg;
		var lay = a.lay;
		var byId = a.byId;
		var lang = a.lang;
		var t = a.t;
		var time = a.time;
		var de = lang === "de";
		var ru = lang === "ru";
		var where = findPlace(lay, p);
		if (!where) {
			return ru ? "На этап " + (l + 1) + " вы не запланированы." : de ? "Für " + t.leg + " " + (l + 1) + " bist du nicht eingeplant." : "You are not planned for " + t.leg + " " + (l + 1) + ".";
		}
		var others = where.slots
			.filter(function (x) {
				return x && x !== p.id;
			})
			.map(function (x) {
				return byId[x].name;
			});
		var from = lg.from.name[lang];
		var to = lg.to.name[lang];
		var when = ru ? "Отправление: " + time + " из «" + from + "» в «" + to + "»." : de ? "Abfahrt: " + time + " Uhr ab " + from + " nach " + to + "." : "Departure: " + time + " from " + from + " to " + to + ".";
		var hi = ru ? "Здравствуйте, " + first(p.name) + "! На этапе " + (l + 1) + " " : de ? "Hallo " + first(p.name) + ", bei " + t.leg + " " + (l + 1) + " " : "Hello " + first(p.name) + ", on " + t.leg + " " + (l + 1) + " ";
		if (ru) {
			return personMessageRu({ where: where, others: others, hi: hi, when: when, byId: byId, lay: lay, p: p, lang: lang });
		}
		var driver, rest, buyerId, buyer;
		if (where.kind === "car") {
			if (where.driver) {
				return de
					? hi + "fährst du im Auto " + where.n + " als Fahrer:in. " + (others.length ? "Deine Mitfahrer:innen: " + joinList(others, lang) + "." : "Du fährst allein.") + " " + when
					: hi + "you drive car " + where.n + ". " + (others.length ? "Your passengers: " + joinList(others, lang) + "." : "You drive alone.") + " " + when;
			}
			driver = byId[where.slots[0]].name;
			rest = others.filter(function (n) {
				return n !== driver;
			});
			return de
				? hi + "fährst du im Auto " + where.n + " mit " + driver + " (Fahrer:in)" + (rest.length ? " und " + joinList(rest, lang) : "") + ". " + when
				: hi + "you ride in car " + where.n + " with " + driver + " (driver)" + (rest.length ? " and " + joinList(rest, lang) : "") + ". " + when;
		}
		if (where.kind === "tram") {
			buyerId = lay.buyers[where.id];
			if (buyerId === p.id) {
				return de
					? hi + "fährst du in Gruppe " + where.n + " mit Bahn und Tram. Du kaufst das Gruppenticket" + (others.length ? " für " + joinList(others, lang) : "") + ". " + when
					: hi + "you travel in group " + where.n + " by public transport. You buy the group ticket" + (others.length ? " for " + joinList(others, lang) : "") + ". " + when;
			}
			buyer = byId[buyerId] ? byId[buyerId].name : undefined;
			return de
				? hi + "fährst du in Gruppe " + where.n + " mit Bahn und Tram" + (others.length ? " zusammen mit " + joinList(others, lang) : "") + ". " + buyer + " kauft das Gruppenticket. " + when
				: hi + "you travel in group " + where.n + " by public transport" + (others.length ? " together with " + joinList(others, lang) : "") + ". " + buyer + " buys the group ticket. " + when;
		}
		return de
			? hi + "fährst du im Taxi " + where.n + (others.length ? " mit " + joinList(others, lang) : "") + ". " + when
			: hi + "you take taxi " + where.n + (others.length ? " with " + joinList(others, lang) : "") + ". " + when;
	}

	// the Russian wording of the message (German and English are written out inline in personMessage)
	// a: { where, others, hi, when, byId, lay, p, lang }
	function personMessageRu(a) {
		var where = a.where;
		var others = a.others;
		var hi = a.hi;
		var when = a.when;
		var byId = a.byId;
		var lay = a.lay;
		var p = a.p;
		var lang = a.lang;
		var driver, rest, buyerId, buyer;
		if (where.kind === "car") {
			if (where.driver) {
				return hi + "вы едете водителем в авто " + where.n + ". " + (others.length ? "Ваши пассажиры: " + joinList(others, lang) + "." : "Вы едете один.") + " " + when;
			}
			driver = byId[where.slots[0]].name;
			rest = others.filter(function (n) {
				return n !== driver;
			});
			return hi + "вы едете в авто " + where.n + " с " + driver + " (водитель)" + (rest.length ? " и " + joinList(rest, lang) : "") + ". " + when;
		}
		if (where.kind === "tram") {
			buyerId = lay.buyers[where.id];
			if (buyerId === p.id) {
				return hi + "вы едете в группе " + where.n + " на общественном транспорте. Вы покупаете групповой билет" + (others.length ? " для " + joinList(others, lang) : "") + ". " + when;
			}
			buyer = byId[buyerId] ? byId[buyerId].name : undefined;
			return hi + "вы едете в группе " + where.n + " на общественном транспорте" + (others.length ? " вместе с " + joinList(others, lang) : "") + ". Групповой билет покупает " + buyer + ". " + when;
		}
		return hi + "вы едете на такси " + where.n + (others.length ? " с " + joinList(others, lang) : "") + ". " + when;
	}

	// fills the workbook; a: { persons, layouts, legs, lang, t, checks, date }
	function fillWorkbook(ExcelJS, a) {
		var persons = a.persons;
		var layouts = a.layouts;
		var legs = a.legs;
		var lang = a.lang;
		var t = a.t;
		var checks = a.checks;
		var date = a.date;

		var wb = new ExcelJS.Workbook();
		wb.creator = "alseda";
		wb.created = new Date();
		wb.calcProperties = { fullCalcOnLoad: true }; // Excel recalculates the cost formulas when the file is opened
		var H = t.csvHead; // Leg, Time, From, To, Name, Transport, Group, Role, Team, Language
		var byId = {};
		persons.forEach(function (p) {
			byId[p.id] = p;
		});
		var routeOf = function (lg) {
			return lg.from.name[lang] + " → " + lg.to.name[lang];
		};
		var timeOf = function (lay, id, lg) {
			return (lay.times && lay.times[id]) || lg.time;
		};
		var counts = function (lay) {
			var n = function (ids) {
				return ids.reduce(function (s, id) {
					return s + lay.boxes[id].filter(isSet).length;
				}, 0);
			};
			return { car: n(lay.order.cars), tram: n(lay.order.groups), taxi: n(lay.order.taxis) };
		};
		var filledBoxes = function (lay, kind) {
			return lay.order[kind].filter(function (id) {
				return lay.boxes[id].some(isSet);
			}).length;
		};

		// ---------- overview ----------
		var ov = wb.addWorksheet(t.xl.overview, { views: [{ showGridLines: false }] });
		ov.columns = [{ width: 12 }, { width: 10 }, { width: 28 }, { width: 28 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 14 }, { width: 12 }];
		band(ov, 1, 10, t.xl.title + " · " + date, C.dark, { size: 16, color: C.white, height: 34 });
		var oh = [H[0], H[1], H[2], H[3], t.persons, t.car, t.segTram, t.taxi, t.notThere, t.checksH];
		oh.forEach(function (l, i) {
			var c = ov.getCell(3, i + 1);
			c.value = l;
			styleCell(c, { fill: i === 5 ? C.car : i === 6 ? C.tram : i === 7 ? C.taxi : i === 8 ? C.grey : C.dark, bold: true, color: i >= 5 && i <= 8 ? undefined : C.white, align: i >= 4 ? "center" : "left" });
		});
		ov.getRow(3).height = 22;
		legs.forEach(function (lg, l) {
			var lay = layouts[l].layout;
			var n = counts(lay);
			var away = persons.filter(function (p) {
				return !p.legs[l];
			}).length;
			var hints = checks.filter(function (c) {
				return c.leg === l;
			}).length;
			var vals = [t.leg + " " + (l + 1), lg.time, lg.from.name[lang], lg.to.name[lang], n.car + n.tram + n.taxi, n.car, n.tram, n.taxi, away, hints];
			vals.forEach(function (v, i) {
				var c = ov.getCell(4 + l, i + 1);
				c.value = v;
				styleCell(c, { fill: i === 5 ? C.carL : i === 6 ? C.tramL : i === 7 ? C.taxiL : i === 8 ? C.greyL : undefined, align: i >= 4 ? "center" : "left", bold: i === 0 || i === 4 });
			});
			ov.getRow(4 + l).height = 22;
		});

		// ---------- one sheet per leg, and one check-in list per leg (same blocks, plus a tick column) ----------
		var legSheet = function (l, withCheck) {
			var lg = legs[l];
			var lay = layouts[l].layout;
			var ws = wb.addWorksheet(withCheck ? t.xl.check + " " + (l + 1) : t.leg + " " + (l + 1), { views: [{ showGridLines: false }] });
			var cols = withCheck ? 6 : 5;
			ws.columns = withCheck ? [{ width: 28 }, { width: 18 }, { width: 22 }, { width: 11 }, { width: 26 }, { width: 14 }] : [{ width: 20 }, { width: 28 }, { width: 22 }, { width: 12 }, { width: 26 }];
			band(ws, 1, cols, (withCheck ? t.xl.check + " · " : "") + t.leg + " " + (l + 1) + " · " + lg.time + " " + t.oclock + "  ·  " + routeOf(lg), C.dark, { size: 14, color: C.white, height: 32 });
			var r = 3;
			// rows: [role, person id] per line
			var block = function (kind, title, rows) {
				var colours = KIND[kind] || [C.grey, C.greyL];
				var strong = colours[0];
				var light = colours[1];
				band(ws, r++, cols, title, strong);
				header(ws, r++, withCheck ? [H[4], H[7], H[8], H[9], t.noteCol, t.xl.checkCol] : [H[7], H[4], H[8], H[9], t.noteCol]);
				rows.forEach(function (pair) {
					var role = pair[0];
					var pid = pair[1];
					var p = byId[pid];
					var vals = withCheck ? [p.name, role, p.team, p.lang, p.note, "☐"] : [role, p.name, p.team, p.lang, p.note];
					vals.forEach(function (v, i) {
						var c = ws.getCell(r, i + 1);
						c.value = v || "";
						var isName = withCheck ? i === 0 : i === 1;
						var isRole = withCheck ? i === 1 : i === 0;
						styleCell(c, {
							fill: light,
							bold: isRole && !!role,
							align: (withCheck && i === 5) || i === 3 ? "center" : "left",
							indent: isName ? 1 : 0,
							size: withCheck && i === 5 ? 16 : 11
						});
					});
					ws.getRow(r).height = withCheck ? 24 : 20;
					r++;
				});
				r++; // empty line between blocks
			};
			lay.order.cars.forEach(function (id, n) {
				var slots = lay.boxes[id];
				block(
					"car",
					t.car + " " + (n + 1) + "  ·  " + t.departAt + " " + timeOf(lay, id, lg) + "  ·  " + slots.filter(isSet).length + "/" + slots.length,
					slots
						.map(function (pid, i) {
							return pid && [i === 0 ? t.driver : "", pid];
						})
						.filter(isSet)
				);
			});
			lay.order.groups.forEach(function (id, n) {
				var slots = lay.boxes[id].filter(isSet);
				var buyer = byId[lay.buyers[id]];
				if (slots.length) {
					block(
						"tram",
						t.group + " " + (n + 1) + "  ·  " + t.departAt + " " + timeOf(lay, id, lg) + "  ·  " + slots.length + "/" + lay.boxes[id].length + "  ·  " + t.buyer + ": " + ((buyer ? buyer.name : undefined) || ""),
						slots.map(function (pid) {
							return [lay.buyers[id] === pid ? t.buyer : "", pid];
						})
					);
				}
			});
			lay.order.taxis.forEach(function (id, n) {
				var slots = lay.boxes[id].filter(isSet);
				if (slots.length) {
					block(
						"taxi",
						t.taxi + " " + (n + 1) + "  ·  " + t.departAt + " " + timeOf(lay, id, lg) + "  ·  " + slots.length + "/" + lay.boxes[id].length,
						slots.map(function (pid) {
							return ["", pid];
						})
					);
				}
			});
			var away = persons.filter(function (p) {
				return !p.legs[l];
			});
			if (away.length) {
				block(
					"away",
					t.notThere + "  ·  " + away.length,
					away.map(function (p) {
						return ["", p.id];
					})
				);
			}
			printSetup(ws);
		};
		legs.forEach(function (_, l) {
			legSheet(l, false);
		});
		legs.forEach(function (_, l) {
			legSheet(l, true);
		});

		// ---------- people: one row per person across both legs (editable, can be loaded back) ----------
		var ps = wb.addWorksheet(t.xl.people, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
		var cols = [t.name, t.team, t.langCol, t.mode, t.seatsOf];
		legs.forEach(function (_, l) {
			cols.push(t.leg + " " + (l + 1), t.assign + " " + (l + 1), H[7] + " " + (l + 1), t.departAt + " " + (l + 1));
		});
		cols.push(t.noteCol);
		var psCols = [{ width: 26 }, { width: 18 }, { width: 11 }, { width: 8 }, { width: 9 }];
		legs.forEach(function () {
			psCols.push({ width: 9 }, { width: 16 }, { width: 14 }, { width: 11 });
		});
		psCols.push({ width: 28 });
		ps.columns = psCols;
		header(ps, 1, cols);
		// per leg: person id -> { kind, label, role, time }
		var where = layouts.map(function (entry, l) {
			var lay = entry.layout;
			var m = {};
			lay.order.cars.forEach(function (id, n) {
				lay.boxes[id].forEach(function (pid, i) {
					if (pid) {
						m[pid] = { kind: "car", label: t.car + " " + (n + 1), role: i === 0 ? t.driver : "", time: timeOf(lay, id, legs[l]) };
					}
				});
			});
			lay.order.groups.forEach(function (id, n) {
				lay.boxes[id].forEach(function (pid) {
					if (pid) {
						m[pid] = { kind: "tram", label: t.group + " " + (n + 1), role: lay.buyers[id] === pid ? t.buyer : "", time: timeOf(lay, id, legs[l]) };
					}
				});
			});
			lay.order.taxis.forEach(function (id, n) {
				lay.boxes[id].forEach(function (pid) {
					if (pid) {
						m[pid] = { kind: "taxi", label: t.taxi + " " + (n + 1), role: "", time: timeOf(lay, id, legs[l]) };
					}
				});
			});
			return m;
		});
		persons.forEach(function (p, i) {
			var row = i + 2;
			var vals = [p.name, p.team, p.lang, p.car ? "✓" : "", p.car ? p.seats : ""];
			legs.forEach(function (lg, l) {
				var w = where[l][p.id];
				vals.push(p.legs[l] ? lg.time : "–", w ? w.label : t.notThere, w ? w.role : "", w ? w.time : "");
			});
			vals.push(p.note || "");
			vals.forEach(function (v, j) {
				var c = ps.getCell(row, j + 1);
				c.value = v;
				var inLegs = j >= 5 && j < 5 + 4 * legs.length;
				var legIdx = inLegs ? Math.floor((j - 5) / 4) : -1;
				var w = legIdx >= 0 ? where[legIdx][p.id] : null;
				var slot = inLegs ? (j - 5) % 4 : -1; // 0 leg time, 1 assignment, 2 role, 3 departure; the last column is the note
				styleCell(c, {
					fill: slot === 1 ? (w ? KIND[w.kind][1] : C.greyL) : i % 2 ? C.greyL : undefined,
					align: j === 0 || j === 1 || slot === 2 || j === 5 + 4 * legs.length ? "left" : "center",
					bold: slot === 1 && !!w
				});
			});
			ps.getRow(row).height = 20;
		});
		ps.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

		// ---------- messages: one ready text per person and leg ----------
		var ms = wb.addWorksheet(t.xl.messages, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
		ms.columns = [{ width: 24 }].concat(
			legs.map(function () {
				return { width: 78 };
			})
		);
		header(
			ms,
			1,
			[t.name].concat(
				legs.map(function (_, l) {
					return t.leg + " " + (l + 1);
				})
			)
		);
		persons.forEach(function (p, i) {
			var row = i + 2;
			var c0 = ms.getCell(row, 1);
			c0.value = p.name;
			styleCell(c0, { bold: true, fill: i % 2 ? C.greyL : undefined });
			legs.forEach(function (lg, l) {
				var lay = layouts[l].layout;
				var w = where[l][p.id];
				var c = ms.getCell(row, l + 2);
				c.value = personMessage({ p: p, l: l, lg: lg, lay: lay, byId: byId, lang: lang, t: t, time: w ? w.time : lg.time });
				styleCell(c, { wrap: true, fill: w ? KIND[w.kind][1] : C.greyL });
			});
			ms.getRow(row).height = 48;
		});

		// ---------- costs: symbolic prices in the yellow cells, the sums are real formulas ----------
		var cs = wb.addWorksheet(t.xl.costs, { views: [{ showGridLines: false }] });
		cs.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }];
		band(cs, 1, 6, t.xl.costs, C.dark, { size: 16, color: C.white, height: 34 });
		var price = function (rowNo, label, value) {
			var ca = cs.getCell(rowNo, 1);
			ca.value = label;
			styleCell(ca, { bold: true, fill: C.greyL });
			var cb = cs.getCell(rowNo, 2);
			cb.value = value;
			styleCell(cb, { fill: C.input, bold: true, align: "center", numFmt: EURO });
		};
		price(3, t.xl.ticketPrice, SYMBOLIC_PRICES.ticket);
		price(4, t.xl.taxiPrice, SYMBOLIC_PRICES.taxi);
		cs.mergeCells(5, 1, 5, 6);
		var note = cs.getCell(5, 1);
		note.value = t.xl.adjust;
		styleCell(note, { border: false, color: "FF6B7280", size: 10 });
		header(cs, 7, [H[0], t.xl.tickets, t.xl.rides, t.xl.ticketCost, t.xl.taxiCost, t.xl.total]);
		var last = 7 + legs.length;
		legs.forEach(function (lg, l) {
			var r = 8 + l - 0;
			var lay = layouts[l].layout;
			var tickets = filledBoxes(lay, "groups");
			var rides = filledBoxes(lay, "taxis");
			var vals = [
				t.leg + " " + (l + 1) + " · " + lg.time,
				tickets,
				rides,
				{ formula: "B" + r + "*$B$3", result: tickets * SYMBOLIC_PRICES.ticket },
				{ formula: "C" + r + "*$B$4", result: rides * SYMBOLIC_PRICES.taxi },
				{ formula: "D" + r + "+E" + r, result: tickets * SYMBOLIC_PRICES.ticket + rides * SYMBOLIC_PRICES.taxi }
			];
			vals.forEach(function (v, i) {
				var c = cs.getCell(r, i + 1);
				c.value = v;
				styleCell(c, { align: i === 0 ? "left" : "center", numFmt: i >= 3 ? EURO : undefined, fill: i === 1 || i === 3 ? C.tramL : i === 2 || i === 4 ? C.taxiL : undefined, bold: i === 5 });
			});
			cs.getRow(r).height = 22;
		});
		var totalRow = last + 1;
		var sum = function (col) {
			return { formula: "SUM(" + col + "8:" + col + last + ")", result: 0 };
		};
		var totals = [t.xl.sum, sum("B"), sum("C"), sum("D"), sum("E"), sum("F")];
		// cached results so that viewers without a calculation engine show numbers too
		var cached = legs.map(function (_, l) {
			var lay = layouts[l].layout;
			var tk = filledBoxes(lay, "groups");
			var rd = filledBoxes(lay, "taxis");
			return [tk, rd, tk * SYMBOLIC_PRICES.ticket, rd * SYMBOLIC_PRICES.taxi, tk * SYMBOLIC_PRICES.ticket + rd * SYMBOLIC_PRICES.taxi];
		});
		totals.forEach(function (v, i) {
			if (i > 0) {
				v.result = cached.reduce(function (s, row) {
					return s + row[i - 1];
				}, 0);
			}
			var c = cs.getCell(totalRow, i + 1);
			c.value = v;
			styleCell(c, { fill: C.dark, color: C.white, bold: true, align: i === 0 ? "left" : "center", numFmt: i >= 3 ? EURO : undefined });
		});
		cs.getRow(totalRow).height = 24;

		// ---------- hints ----------
		if (checks.length) {
			var hs = wb.addWorksheet(t.checksH, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
			hs.columns = [{ width: 12 }, { width: 14 }, { width: 90 }];
			header(hs, 1, [H[0], t.xl.level, t.checksH]);
			checks.forEach(function (c, i) {
				var row = i + 2;
				[t.leg + " " + (c.leg + 1), c.level === "warn" ? t.levelWarn : t.levelInfo, t.chk[c.code](c.args, t.kinds)].forEach(function (v, j) {
					var cell = hs.getCell(row, j + 1);
					cell.value = v;
					styleCell(cell, { fill: j === 1 ? (c.level === "warn" ? C.warn : C.grey) : undefined, bold: j === 1, wrap: j === 2, align: j === 2 ? "left" : "center" });
				});
			});
		}

		return wb;
	}

	// a: { persons, layouts, legs, lang, t, checks, date } -> Promise for the .xlsx as a Blob
	function buildWorkbook(a) {
		return loadExcelJS()
			.then(function (ExcelJS) {
				return fillWorkbook(ExcelJS, a).xlsx.writeBuffer();
			})
			.then(function (buffer) {
				return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
			});
	}

	return { SYMBOLIC_PRICES: SYMBOLIC_PRICES, buildWorkbook: buildWorkbook };
});
