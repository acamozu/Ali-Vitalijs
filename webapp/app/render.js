sap.ui.define([
	"../model/planner",
	"../model/checks",
	"../model/share",
	"../model/icons"
], function (Planner, Checks, Share, Icons) {
	"use strict";

	// The markup of the page as one string, built from the view data of App.js (`v`). Structure and class names are
	// those of the web version (React), so css/style.css is shared 1:1. Nothing here changes state: every element
	// that does something carries data-a (click), data-i (input), data-b (blur), data-c (change) or data-s (submit),
	// and App.js runs the action of that name.

	var LEGS = Planner.LEGS;
	var RULE_GRADS = ["var(--grad-peach)", "var(--grad-lilac)", "var(--grad-blue)", "var(--grad-green)"];

	function esc(v) {
		return String(v === null || v === undefined ? "" : v)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	// data-a="name" data-v="value" [data-w="second value"]
	function act(sName, vValue, vSecond) {
		return ' data-a="' + sName + '"' +
			(vValue === undefined ? "" : ' data-v="' + esc(vValue) + '"') +
			(vSecond === undefined ? "" : ' data-w="' + esc(vSecond) + '"');
	}

	function ic(sName, vSize, mOpts) {
		return Icons.icon(sName, vSize, mOpts);
	}

	function pressed(b) {
		return ' aria-pressed="' + (b ? "true" : "false") + '"';
	}

	function on(b) {
		return b ? ' class="on"' : "";
	}

	// ---------- dropdown (trigger only; App.js opens the list as an overlay) ----------
	// mSel: { id, value, options: [{ value, label }], label, placeholder, className, noClear, align, disabled, action, arg }
	function select(v, mSel) {
		var oChosen = null;
		mSel.options.forEach(function (o) {
			if (o.value === mSel.value && mSel.value !== "") {
				oChosen = o;
			}
		});
		var sPlaceholder = mSel.placeholder === undefined ? "–" : mSel.placeholder;
		v.selects[mSel.id] = mSel;
		return '<button type="button" role="combobox" aria-haspopup="listbox" class="select__trigger ' + (mSel.className || "") + '"' +
			' aria-label="' + esc(mSel.label || "") + '" aria-expanded="' + (v.selectOpen === mSel.id ? "true" : "false") + '"' +
			' data-a="select" data-v="' + esc(mSel.id) + '"' +
			(v.selectOpen === mSel.id ? ' data-popup-open=""' : "") +
			(oChosen ? "" : ' data-placeholder=""') +
			(mSel.disabled ? ' disabled="" data-disabled=""' : "") + ">" +
			'<span class="select__value"' + (oChosen ? "" : ' data-placeholder=""') + ">" + esc(oChosen ? oChosen.label : sPlaceholder) + "</span>" +
			'<svg class="select__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
			"</button>";
	}

	// the open list of a dropdown (rendered into the overlay layer by App.js)
	function selectPopup(mSel, iHighlight) {
		var aItems = mSel.noClear ? mSel.options : [{ value: "__none", label: mSel.clearLabel || "–" }].concat(mSel.options);
		return '<div class="select__popup" role="listbox" tabindex="-1"><div class="select__list">' +
			aItems.map(function (o, i) {
				var bSelected = o.value === mSel.value && mSel.value !== "";
				return '<div class="select__item" role="option" data-opt="' + i + '" aria-selected="' + (bSelected ? "true" : "false") + '"' +
					(bSelected ? ' data-selected=""' : "") + (i === iHighlight ? ' data-highlighted=""' : "") + ">" +
					'<span class="select__item-text">' + esc(o.label) + "</span>" +
					(bSelected ? '<span class="select__check"><svg class="select__check-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>' : "") +
					"</div>";
			}).join("") +
			"</div></div>";
	}

	// ---------- small parts ----------
	function stepper(sLabel, iValue, iMin, iMax, sAction, sArg) {
		return '<div class="lim"><span>' + esc(sLabel) + "</span>" +
			'<span class="stepper small" role="group" aria-label="' + esc(sLabel) + '">' +
			"<button" + act(sAction, Math.max(iMin, iValue - 1), sArg) + (iValue <= iMin ? ' disabled=""' : "") + ' aria-label="−1">' + ic("Minus", 14) + "</button>" +
			"<strong>" + iValue + "</strong>" +
			"<button" + act(sAction, Math.min(iMax, iValue + 1), sArg) + (iValue >= iMax ? ' disabled=""' : "") + ' aria-label="+1">' + ic("Plus", 14) + "</button>" +
			"</span></div>";
	}

	function moveBar(v, sKey, i) {
		var t = v.t;
		var sLabel = t.sections[sKey];
		return '<div class="move-bar" data-k="move-' + sKey + '">' + ic("GripVertical", 16) +
			"<span>" + esc(sLabel) + "</span><div>" +
			"<button" + act("moveSection", i, -1) + (i === 0 ? ' disabled=""' : "") + ' aria-label="' + esc(t.up + ": " + sLabel) + '" title="' + esc(t.up) + '">' + ic("ArrowUp", 16) + "</button>" +
			"<button" + act("moveSection", i, 1) + (i === v.sectionOrder.length - 1 ? ' disabled=""' : "") + ' aria-label="' + esc(t.down + ": " + sLabel) + '" title="' + esc(t.down) + '">' + ic("ArrowDown", 16) + "</button>" +
			"</div></div>";
	}

	// departure time of one vehicle, always 24 h; grey while it is the time of the leg (typing is handled in App.js)
	function departTime(v, sId) {
		var sValue = v.times[sId] || v.L.time;
		return '<input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" autocomplete="off"' +
			' class="time-input' + (sValue === v.L.time ? " base" : "") + '" value="' + esc(sValue) + '"' +
			' aria-label="' + esc(v.t.departAt) + '" title="' + esc(v.t.departAt + " (24 h)") + '"' +
			' data-f="timeFocus" data-i="timeInput" data-b="time" data-v="' + esc(sId) + '" data-kd="time">';
	}

	function tagDot(v, p, sClass) {
		if (!p.lang) {
			return "";
		}
		return '<span class="' + (sClass || "lang-tag") + '" title="' + esc(v.tagTitle(p)) + '">' + esc(p.lang) + "</span>";
	}

	function noteFlag(sNote, bInline) {
		return '<span class="note-flag' + (bInline ? " inline" : "") + '" title="' + esc(sNote) + '" aria-label="' + esc(sNote) + '">' + ic("Info", "100%") + "</span>";
	}

	// classes of a seat / place: being dragged, chosen by tapping (the drop target is marked directly in the DOM)
	function seatFx(v, sBox, i) {
		var bDrag = v.drag && String(v.drag.car) === String(sBox) && v.drag.idx === i;
		var bPicked = v.picked && String(v.picked.car) === String(sBox) && v.picked.idx === i;
		return { cls: (bDrag ? " is-dragging" : "") + (bPicked ? " is-picked" : ""), picked: !!bPicked };
	}

	function tapAttrs(sBox, i, bPicked) {
		return ' data-seat="' + esc(sBox) + ":" + i + '" role="button" tabindex="0" aria-pressed="' + (bPicked ? "true" : "false") + '" data-a="tap"';
	}

	function seat(v, p, i, sCar) {
		var fx = seatFx(v, sCar, i);
		if (!p) {
			return '<div class="seat empty' + fx.cls + '"' + tapAttrs(sCar, i, fx.picked) + '><span class="seat-name">' + esc(v.t.free) + "</span></div>";
		}
		var bDriver = i === 0;
		return '<div class="seat ' + (bDriver ? "driver" : "rider") + fx.cls + '"' + (bDriver ? "" : tapAttrs(sCar, i, fx.picked) + ' data-drag=""') + ">" +
			tagDot(v, p) +
			(p.note ? noteFlag(p.note) : "") +
			(bDriver ? '<span class="seat-role">' + esc(v.t.driver) + "</span>" : "") +
			'<span class="seat-name">' + p.name.split(" ").map(function (w) { return "<span>" + esc(w) + "</span>"; }).join("") + "</span>" +
			(p.team ? '<span class="seat-region" title="' + esc(p.team) + '">' + esc(p.team) + "</span>" : "") +
			"</div>";
	}

	// seat map: front row = driver + front passenger, then rows of up to 3
	function seatRows(aSlots) {
		var aList = aSlots.map(function (p, i) { return { p: p, i: i }; });
		var aRows = [aList.slice(0, 2)];
		for (var i = 2; i < aList.length; i += 3) {
			aRows.push(aList.slice(i, i + 3));
		}
		return aRows.filter(function (r) { return r.length; });
	}

	function carMap(v, sCar) {
		var aSlots = v.boxes[sCar].map(function (pid) { return pid ? v.byId[pid] : null; });
		return '<div class="car-map" role="group" aria-label="' + esc(v.t.car + " " + sCar) + '">' + Icons.carArt() +
			'<div class="car-seats">' +
			seatRows(aSlots).map(function (aRow) {
				return '<div class="seat-row n' + aRow.length + '">' + aRow.map(function (o) { return seat(v, o.p, o.i, sCar); }).join("") + "</div>";
			}).join("") +
			"</div></div>";
	}

	// one place in a tram group or taxi; in groups the ticket icon picks the buyer
	function slot(v, p, i, sBox, sKind) {
		var fx = seatFx(v, sBox, i);
		if (!p) {
			return '<li class="pp slot empty' + fx.cls + '"' + tapAttrs(sBox, i, fx.picked) + ">" +
				'<span class="dot free">' + ic("Plus", 14) + '</span><span class="pp-name">' + esc(v.t.free) + "</span></li>";
		}
		var bBuyer = sKind === "tram" && v.buyers[sBox] === p.id;
		return '<li class="pp slot' + fx.cls + '"' + tapAttrs(sBox, i, fx.picked) + ' data-drag="">' +
			'<span class="dot ' + (sKind === "taxi" ? "car" : "train") + '">' + ic(sKind === "taxi" ? "Car" : "Train", 15) + "</span>" +
			'<span class="pp-name">' + esc(p.name) + "</span>" +
			(p.team ? '<span class="team-chip" title="' + esc(p.team) + '">' + esc(p.team) + "</span>" : "") +
			tagDot(v, p, "lang-tag inline") +
			(p.note ? noteFlag(p.note, true) : "") +
			(sKind === "tram"
				? '<button class="buy' + (bBuyer ? " on" : "") + '"' + act("buyer", sBox, p.id) + pressed(bBuyer) +
					' aria-label="' + esc(v.t.makeBuyer + ": " + p.name) + '" title="' + esc(v.t.makeBuyer) + '">' + ic("Ticket", 13) +
					(bBuyer ? "<span>" + esc(v.t.buyer) + "</span>" : "") + "</button>"
				: "") +
			"</li>";
	}

	function filled(v, sId) {
		return v.boxes[sId].filter(Boolean).length;
	}

	function boxHead(v, sTitle, sId, sKind) {
		return '<div class="pcard-head"><h3>' + esc(sTitle) + "</h3>" + departTime(v, sId) +
			'<span class="pcard-fill">' + filled(v, sId) + "/" + v.boxes[sId].length + "</span>" +
			(sKind && filled(v, sId) === 0
				? '<button class="icon-btn"' + act("removeBox", sKind, sId) + ' aria-label="' + esc(v.t.removeBox) + '" title="' + esc(v.t.removeBox) + '">' + ic("X", 16) + "</button>"
				: "") +
			"</div>";
	}

	// ---------- the nine sections ----------
	var Section = {};

	Section.leg = function (v) {
		var t = v.t;
		return '<div class="tile cp-bar bar-leg" data-k="s-leg">' +
			'<span class="cp-bar-label">' + esc(t.leg) + "</span>" +
			'<div class="pill-field">' +
			'<div class="seg" role="group" aria-label="' + esc(t.leg) + '">' +
			LEGS.map(function (lg, i) {
				return "<button" + on(i === v.leg) + act("setLeg", i) + pressed(i === v.leg) + ">" + (i + 1) + " · " + esc(lg.time) + "</button>";
			}).join("") +
			"</div>" +
			'<div class="field-group"><span>' + esc(t.restBy) + "</span>" +
			'<div class="seg" role="group" aria-label="' + esc(t.restBy) + '">' +
			[["tram", t.segTram], ["taxi", t.segTaxi]].map(function (a) {
				return "<button" + on(v.restBy === a[0]) + act("setRestBy", a[0]) + pressed(v.restBy === a[0]) + ">" + esc(a[1]) + "</button>";
			}).join("") +
			"</div></div></div>" +
			'<button class="btn-grad"' + act("exportPlan") + ">" + ic("Download", 16) + " " + esc(t.export) + "</button>" +
			"</div>";
	};

	Section.plan = function (v) {
		var t = v.t;
		return '<div class="tile cp-bar bar-plan" data-k="s-plan">' +
			'<span class="cp-bar-label">' + esc(t.optionsLabel) + "</span>" +
			'<div class="pill-field"><div class="field-group"><span>' + esc(t.groupBy) + "</span>" +
			'<div class="seg" role="group" aria-label="' + esc(t.groupBy) + '">' +
			[["none", t.groupNone], ["team", t.groupTeam], ["lang", t.groupLang]].map(function (a) {
				return "<button" + on(v.groupBy === a[0]) + act("setGroupBy", a[0]) + pressed(v.groupBy === a[0]) + ">" + esc(a[1]) + "</button>";
			}).join("") +
			"</div></div></div>" +
			'<div class="bar-actions">' +
			'<div class="bar-undo">' +
			'<button class="ghost icon-only"' + act("undo") + (v.canUndo ? "" : ' disabled=""') + ' aria-label="' + esc(t.undo) + '" title="' + esc(t.undo + " (Ctrl+Z)") + '">' + ic("Undo2", 17) + "</button>" +
			'<button class="ghost icon-only"' + act("redo") + (v.canRedo ? "" : ' disabled=""') + ' aria-label="' + esc(t.redo) + '" title="' + esc(t.redo + " (Ctrl+Y)") + '">' + ic("Redo2", 17) + "</button>" +
			"</div>" +
			'<div class="bar-files">' +
			'<button class="ghost"' + act("savePlan") + ' title="' + esc(t.planHint) + '">' + ic("Save", 15) + " " + esc(t.savePlan) + "</button>" +
			'<button class="ghost"' + act("pickFile", "plan") + ' title="' + esc(t.planHint) + '">' + ic("FolderOpen", 15) + " " + esc(t.loadPlan) + "</button>" +
			'<button class="ghost"' + act("copyLeg") + ' title="' + esc(t.copyLegTip) + '">' + ic("Copy", 15) + " " + esc(t.copyLeg2) + "</button>" +
			"</div>" +
			'<input type="file" data-file="plan" accept=".json,application/json,.xlsx" data-c="loadPlan" hidden="">' +
			// where the plan is kept (SAP system or only this browser) and whether the last change is saved
			'<span class="save-state ' + v.sync.state + '" role="status" title="' + esc(v.sync.title) + '"' + (v.sync.action ? act(v.sync.action) + ' tabindex="0"' : "") + ">" +
			"<i></i>" + esc(v.sync.text) + "</span>" +
			"</div></div>";
	};

	Section.counts = function (v) {
		var t = v.t;
		var c = v.count;
		return '<div class="cp-counts" data-k="s-counts">' +
			[
				["car", c.car, t.byCar, v.carMin, Math.min(v.carMax, v.total)],
				["tram", c.tram, t.byTram, 0, v.total - c.car],
				["taxi", c.taxi, t.byTaxi, 0, v.total - c.car]
			].map(function (a) {
				return '<div class="count c-' + a[0] + '">' +
					'<div class="count-ctl" role="group" aria-label="' + esc(a[2]) + '">' +
					"<button" + act("setCounts", a[0], a[1] - 1) + (a[1] <= a[3] ? ' disabled=""' : "") + ' aria-label="' + esc(a[2] + " −1") + '">' + ic("Minus", 16) + "</button>" +
					"<button" + act("setCounts", a[0], a[1] + 1) + (a[1] >= a[4] ? ' disabled=""' : "") + ' aria-label="' + esc(a[2] + " +1") + '">' + ic("Plus", 16) + "</button>" +
					"</div><strong>" + a[1] + "</strong><span>" + esc(a[2]) + "</span></div>";
			}).join("") +
			"</div>";
	};

	Section.checks = function (v) {
		var t = v.t;
		var iReady = v.rules.filter(Checks.ruleReady).length;
		return '<section id="checks" class="tile" data-k="s-checks">' +
			'<div class="checks-head"><h2 class="tile-title">' + esc(t.checksH) + "</h2>" +
			'<span class="warn-badge' + (v.warns ? "" : " calm") + '">' + v.checks.length + "</span>" +
			'<button class="ghost rules-open"' + act("openRules") + ' aria-haspopup="dialog">' + ic("ListPlus", 15) + " " + esc(t.rulesBtn) + (iReady ? " (" + iReady + ")" : "") + "</button>" +
			"</div>" +
			'<p class="tile-note">' + esc(t.checksSub) + "</p>" +
			(v.checks.length
				? '<ul class="check-list">' + v.checks.map(function (c, i) {
					return '<li class="check go ' + c.level + '" role="button" tabindex="0"' + act("goToCheck", i) + ">" +
						'<span class="check-icon">' + ic(c.level === "warn" ? "TriangleAlert" : "Info", 16) + "</span>" +
						'<span class="check-leg">' + esc(t.legWord) + " " + (c.leg + 1) + "</span>" +
						'<span class="check-text">' + esc(t.chk[c.code](c.args, t.kinds)) + "</span>" +
						ic("ArrowRight", 16, { className: "check-go" }) + "</li>";
				}).join("") + "</ul>"
				: '<p class="check ok"><span class="check-icon">' + ic("CircleCheck", 18) + "</span> " + esc(t.noIssues) + "</p>") +
			"</section>";
	};

	Section.cars = function (v) {
		var t = v.t;
		return '<section id="cars" class="tile" data-k="s-cars">' +
			'<h2 class="tile-title">' + esc(t.carsH) + " (" + v.count.car + ")</h2>" +
			'<p class="tile-note">' + esc(t.carsSub) + "</p>" +
			(v.order.cars.length
				? '<p class="tile-note drag-hint">' + esc(t.moveHint) + "</p>" +
					'<div class="plan-grid">' + v.order.cars.map(function (sId, n) {
						return '<article class="pcard" data-k="' + sId + '">' + boxHead(v, t.car + " " + (n + 1), sId, "") + carMap(v, sId) + "</article>";
					}).join("") + "</div>"
				: '<p class="tile-note">' + esc(t.noCars) + "</p>") +
			"</section>";
	};

	Section.tram = function (v) {
		var t = v.t;
		var R = Planner.LIMIT_RANGE;
		return '<section id="tram" class="tile" data-k="s-tram">' +
			'<h2 class="tile-title">' + esc(t.tramH) + " (" + v.count.tram + ")</h2>" +
			'<p class="tile-note">' + esc(t.tramSub(v.from)) + "</p>" +
			'<div class="box-tools">' +
			stepper(t.groupCount, v.order.groups.length, v.groupPeople ? Math.ceil(v.groupPeople / v.limits.groupMax) : 0, v.groupPeople ? v.groupPeople : R[1], "setGroupCount") +
			stepper(t.groupSize, v.limits.groupMax, R[0], R[1], "setLimit", "groupMax") +
			'<span class="chip-static hide-m">' + ic("Ticket", 14) + " " + esc(t.tickets(v.tickets)) + "</span>" +
			"</div>" +
			(v.order.groups.length
				? '<div class="plan-grid">' + v.order.groups.map(function (sId, n) {
					return '<article class="pcard" data-k="' + sId + '">' + boxHead(v, t.group + " " + (n + 1), sId, "groups") +
						"<ul>" + v.boxes[sId].map(function (pid, i) { return slot(v, pid ? v.byId[pid] : null, i, sId, "tram"); }).join("") + "</ul></article>";
				}).join("") + "</div>"
				: '<p class="tile-note">' + esc(t.nothing) + "</p>") +
			"</section>";
	};

	Section.taxi = function (v) {
		var t = v.t;
		var R = Planner.TAXI_RANGE;
		return '<section id="taxi" class="tile" data-k="s-taxi">' +
			'<h2 class="tile-title">' + esc(t.taxiH) + " (" + v.count.taxi + ")</h2>" +
			'<p class="tile-note">' + esc(t.taxiSub) + "</p>" +
			'<div class="box-tools">' +
			stepper(t.taxiSize, v.limits.taxiSeats, R[0], R[1], "setLimit", "taxiSeats") +
			'<button class="ghost"' + act("addBox", "taxis") + ">" + ic("Plus", 15) + " " + esc(t.addTaxi) + "</button>" +
			"</div>" +
			(v.order.taxis.length
				? '<div class="plan-grid">' + v.order.taxis.map(function (sId, n) {
					return '<article class="pcard" data-k="' + sId + '">' + boxHead(v, t.taxi + " " + (n + 1), sId, "taxis") +
						"<ul>" + v.boxes[sId].map(function (pid, i) { return slot(v, pid ? v.byId[pid] : null, i, sId, "taxi"); }).join("") + "</ul></article>";
				}).join("") + "</div>"
				: '<p class="tile-note">' + esc(t.nothing) + "</p>") +
			"</section>";
	};

	function personRow(v, p, aTeams) {
		var t = v.t;
		var a = v.assignment[p.id];
		var bOpen = !!v.openRows[p.id];
		return '<tr data-k="' + esc(p.id) + '" class="' + (p.legs[v.leg] ? "" : "is-away") + (bOpen ? "" : " folded") + '">' +
			'<td class="c-num" data-label="#">' + (v.persons.indexOf(p) + 1) + "</td>" +
			'<td data-label="' + esc(t.name) + '">' + esc(p.name) + "</td>" +
			'<td data-label="' + esc(t.team) + '">' +
			select(v, {
				id: "team:" + p.id, className: "wide", value: p.team, label: t.team + ": " + p.name, action: "patchPerson", arg: [p.id, "team"],
				options: (p.team && aTeams.indexOf(p.team) === -1 ? aTeams.concat([p.team]).sort(function (x, y) { return x.localeCompare(y); }) : aTeams).map(function (s) { return { value: s, label: s }; })
			}) + "</td>" +
			'<td data-label="' + esc(t.langCol) + '">' +
			select(v, {
				id: "lang:" + p.id, value: p.lang, label: t.langCol + ": " + p.name, action: "patchPerson", arg: [p.id, "lang"],
				options: Planner.LANG_OPTIONS.map(function (s) { return { value: s, label: s }; })
			}) + "</td>" +
			'<td data-label="' + esc(t.noteCol) + '">' +
			'<input class="cell-input note" value="' + esc(p.note) + '" maxlength="60" placeholder="–" autocomplete="off" aria-label="' + esc(t.noteCol + ": " + p.name) + '" data-b="note" data-v="' + esc(p.id) + '" data-kd="blur">' +
			"</td>" +
			'<td data-label="' + esc(t.mode) + '"><span class="car-cell">' +
			'<button class="chip' + (p.car ? " on" : "") + '"' + act("toggleCar", p.id) + pressed(p.car) + ' aria-label="' + esc(t.mode + ": " + p.name) + '">' + ic("Car", 14) + "</button>" +
			(p.car
				? '<span class="mini" role="group" aria-label="' + esc(t.seatsOf) + '">' +
					"<button" + act("setSeats", p.id, Math.max(Planner.MIN_SEATS, p.seats - 1)) + ' aria-label="−">' + ic("Minus", 12) + "</button>" +
					"<span>" + p.seats + " " + esc(t.seatsOf) + "</span>" +
					"<button" + act("setSeats", p.id, Math.min(Planner.CAR_SEATS, p.seats + 1)) + ' aria-label="+">' + ic("Plus", 12) + "</button></span>"
				: "") +
			"</span></td>" +
			LEGS.map(function (lg, i) {
				return '<td data-label="' + esc(t.leg + " " + (i + 1)) + '">' +
					'<button class="chip' + (p.legs[i] ? " on" : "") + '"' + act("toggleLeg", p.id, i) + pressed(p.legs[i]) + ' aria-label="' + esc(t.leg + " " + (i + 1) + ": " + p.name) + '">' +
					(p.legs[i] ? ic("Check", 14, { strokeWidth: 3 }) : ic("X", 14)) + " " + esc(lg.time) + "</button></td>";
			}).join("") +
			'<td data-label="' + esc(t.assign) + '">' +
			(a
				? '<span class="assign"><span class="pill ' + a.kind + '">' + esc(a.label) + "</span>" + (a.role ? '<span class="role"> · ' + esc(a.role) + "</span>" : "") + "</span>"
				: '<span class="assign"><span class="pill away">' + esc(t.notThere) + "</span></span>") +
			"</td>" +
			'<td class="c-del" data-label="">' +
			'<button class="fold-btn"' + act("toggleRow", p.id) + ' aria-expanded="' + (bOpen ? "true" : "false") + '" aria-label="' + esc(p.name + ": " + (bOpen ? t.foldClose : t.foldOpen)) + '">' + ic("ChevronDown", 18) + "</button>" +
			'<button class="icon-btn"' + act("askRemove", p.id) + ' aria-label="' + esc(t.remove + ": " + p.name) + '" title="' + esc(t.remove) + '">' + ic("Trash2", 16) + "</button>" +
			"</td></tr>";
	}

	Section.people = function (v) {
		var t = v.t;
		var aTeams = v.teamList;
		return '<section id="all" class="tile" data-k="s-people">' +
			'<h2 class="tile-title">' + esc(t.allH) + " (" + v.rows.length + ")</h2>" +
			'<p class="tile-note">' + esc(t.allSub) + "</p>" +
			'<div class="roster-tools">' +
			'<div class="stepper" role="group" aria-label="' + esc(t.count) + '">' +
			"<button" + act("setCount", Math.max(1, v.persons.length - 1)) + ' aria-label="−1">' + ic("Minus", 16) + "</button>" +
			"<strong>" + v.persons.length + "</strong>" +
			"<button" + act("setCount", v.persons.length + 1) + ' aria-label="+1">' + ic("Plus", 16) + "</button></div>" +
			'<form class="add-form" data-s="submitAdd">' +
			'<input value="' + esc(v.newName) + '" placeholder="' + esc(t.addPh) + '" aria-label="' + esc(t.addPh) + '" autocomplete="off" data-i="newName">' +
			'<button type="submit" class="ghost">' + esc(t.add) + "</button></form>" +
			'<button class="ghost"' + act("pickFile", "csv") + ">" + ic("Upload", 15) + " " + esc(t.load) + "</button>" +
			'<input type="file" data-file="csv" accept=".csv,.txt,text/csv" data-c="loadFile" hidden="">' +
			'<button class="ghost"' + act("resetData") + ">" + ic("RotateCcw", 15) + " " + esc(t.reset) + "</button>" +
			"</div>" +
			'<p class="tile-note csv-hint">' + esc(t.csvHint) + "</p>" +
			'<div class="cp-filter" role="group">' +
			[["all", t.filterAll], ["car", t.car], ["driver", t.driver], ["tram", t.segTram], ["taxi", t.taxi], ["away", t.filterAway]].map(function (a) {
				return "<button" + on(v.filter === a[0]) + act("setFilter", a[0]) + pressed(v.filter === a[0]) + ">" + esc(a[1]) + "</button>";
			}).join("") + "</div>" +
			(v.tagInfo.values.length
				? '<div class="cp-filter tags" role="group">' + [null].concat(v.tagInfo.values).map(function (s) {
					return "<button" + on(v.tagFilter === s) + (s === null ? act("setTagFilter") : act("setTagFilter", s)) + pressed(v.tagFilter === s) + ">" +
						(s ? '<i style="background: ' + esc(v.tagInfo.color(s)) + '"></i>' : "") +
						esc(s === null ? (v.filterBy === "lang" ? t.langCol : t.team) + ": " + t.all : s) + "</button>";
				}).join("") + "</div>"
				: "") +
			(!v.rows.length && v.newName.trim() ? '<p class="tile-note">' + esc(t.noMatch(v.newName.trim())) + "</p>" : "") +
			'<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
			"<th>#</th><th>" + esc(t.name) + "</th><th>" + esc(t.team) + "</th><th>" + esc(t.langCol) + "</th><th>" + esc(t.noteCol) + "</th><th>" + esc(t.mode) + "</th>" +
			LEGS.map(function (lg, i) { return "<th>" + esc(t.leg) + " " + (i + 1) + "</th>"; }).join("") +
			"<th>" + esc(t.assign) + '</th><th aria-label="' + esc(t.remove) + '"></th>' +
			"</tr></thead><tbody>" +
			v.rows.map(function (p) { return personRow(v, p, aTeams); }).join("") +
			"</tbody></table></div></section>";
	};

	Section.cards = function (v) {
		var t = v.t;
		var aCards = v.legCards[v.leg].cards;
		return '<section id="cards" class="tile" data-k="s-cards">' +
			'<h2 class="tile-title">' + esc(t.cardsH) + "</h2>" +
			'<p class="tile-note">' + esc(t.cardsSub) + "</p>" +
			'<div class="box-tools"><button class="ghost"' + act("copyCards") + ">" + ic("Copy", 15) + " " + esc(t.copyLeg) + "</button></div>" +
			'<div class="plan-grid">' + aCards.map(function (c) {
				return '<article class="pcard info-card" data-k="' + c.id + '">' +
					'<div class="pcard-head"><h3>' + esc(c.title) + "</h3>" +
					'<button class="icon-btn"' + act("copyCard", c.id) + ' aria-label="' + esc(t.copy + ": " + c.title) + '" title="' + esc(t.copy) + '">' + ic("Copy", 16) + "</button></div>" +
					(c.lead ? '<p class="info-lead"><span>' + esc(c.lead[0]) + "</span> " + esc(c.lead[1]) + "</p>" : "") +
					'<p class="info-label">' + esc(c.kind === "car" ? t.passengers : t.members) + "</p>" +
					'<p class="info-people">' + esc(c.people.join(", ") || "–") + "</p></article>";
			}).join("") + "</div></section>";
	};

	// ---------- fixed parts: dialogs, bars, navbar, side menu, footer ----------
	function confirmRemove(v) {
		var t = v.t;
		return '<div class="modal-backdrop" data-k="confirm"' + act("cancelRemove") + ">" +
			'<div class="modal confirm" role="alertdialog" aria-modal="true" aria-label="' + esc(t.remove) + '" data-stop="">' +
			"<h2>" + esc(t.removeAsk(v.byId[v.delAsk].name)) + "</h2>" +
			'<div class="confirm-actions">' +
			'<button class="ghost"' + act("cancelRemove") + ' data-af="confirm">' + esc(t.cancel) + "</button>" +
			'<button class="ghost danger"' + act("removeNow") + ">" + ic("Trash2", 15) + " " + esc(t.remove) + "</button>" +
			"</div></div></div>";
	}

	// the plan on the server was changed by someone else since it was loaded here
	function conflictDialog(v) {
		var x = v.x;
		return '<div class="modal-backdrop" data-k="conflict">' +
			'<div class="modal confirm" role="alertdialog" aria-modal="true" aria-label="' + esc(x.conflictH) + '" data-stop="">' +
			"<h2>" + esc(x.conflictH) + "</h2>" +
			'<p class="tile-note">' + esc(x.conflictText(v.conflict.by, v.conflict.at)) + "</p>" +
			'<div class="confirm-actions">' +
			'<button class="ghost"' + act("conflictReload") + ' data-af="conflict">' + ic("RotateCcw", 15) + " " + esc(x.conflictReload) + "</button>" +
			'<button class="ghost danger"' + act("conflictOverwrite") + ">" + ic("Save", 15) + " " + esc(x.conflictOverwrite) + "</button>" +
			"</div></div></div>";
	}

	var RULE_CHOICES = ["noTaxi", "noTram", "inCar", "notAlone"];
	var RULE_CHOICE_TEXT = { noTaxi: "personNoTaxi", noTram: "personNoTram", inCar: "personInCar", notAlone: "personNotAlone" };

	// one custom rule: on/off, its sentence made of dropdowns, warning or info, delete
	function ruleRow(v, r, aPeople) {
		var t = v.t;
		var bOff = !r.on;
		var sBody = "";
		var fnSel = function (sField, m) {
			m.id = "rule:" + r.id + ":" + sField;
			m.disabled = bOff;
			m.noClear = true;
			m.action = "setRuleField";
			m.arg = [r.id, sField];
			return select(v, m);
		};
		var aRuleOptions = RULE_CHOICES.map(function (k) { return { value: k, label: t[RULE_CHOICE_TEXT[k]] }; });
		if (r.type === "pair") {
			sBody = fnSel("a", { className: "wide", value: r.a, options: aPeople.filter(function (o) { return o.value !== r.b; }), placeholder: t.pickPerson, label: t.pickPerson }) +
				"<span>" + esc(t.pairWith) + "</span>" +
				fnSel("b", { className: "wide", value: r.b, options: aPeople.filter(function (o) { return o.value !== r.a; }), placeholder: t.pickPerson, label: t.pickPerson }) +
				fnSel("mode", { className: "wide", value: r.mode, options: [{ value: "together", label: t.pairTogether }, { value: "apart", label: t.pairApart }] });
		} else if (r.type === "lang") {
			sBody = "<span>" + esc(t.ruleLangA) + "</span>" +
				fnSel("lang", { value: r.lang, options: Planner.LANG_OPTIONS.map(function (s) { return { value: s, label: s }; }), label: t.langCol });
		} else if (r.type === "teamMax") {
			sBody = "<span>" + esc(t.ruleTeamA) + "</span>" +
				fnSel("max", { value: String(r.max), options: [1, 2, 3, 4, 5].map(function (n) { return { value: String(n), label: String(n) }; }), label: "max" }) +
				"<span>" + esc(t.ruleTeamB) + "</span>" +
				fnSel("team", { className: "wide", value: r.team, options: [{ value: "*", label: t.allTeams }].concat(v.teamList.map(function (s) { return { value: s, label: s }; })), label: t.team });
		} else if (r.type === "note") {
			sBody = "<span>" + esc(t.noteRuleA) + "</span>" +
				'<input class="cell-input keyword" value="' + esc(r.keyword) + '" maxlength="30" placeholder="' + esc(t.keyword) + '" aria-label="' + esc(t.keyword) + '" autocomplete="off"' +
				(bOff ? ' disabled=""' : "") + ' data-b="keyword" data-v="' + esc(r.id) + '" data-kd="blur">' +
				fnSel("rule", { className: "wide", value: r.rule, options: aRuleOptions });
		} else if (r.type === "person") {
			sBody = fnSel("p", { className: "wide", value: r.p, options: aPeople, placeholder: t.pickPerson, label: t.pickPerson }) +
				fnSel("rule", { className: "wide", value: r.rule, options: aRuleOptions });
		}
		var sLevel = (r.level === "warn" ? t.levelWarn : t.levelInfo) + " – " + t.levelToggle;
		return '<li class="rule-row' + (r.on ? "" : " off") + '" data-k="' + esc(r.id) + '">' +
			'<button class="switch' + (r.on ? " on" : "") + '" role="switch" aria-checked="' + (r.on ? "true" : "false") + '" aria-label="' + esc(t.ruleOn) + '" title="' + esc(t.ruleOn) + '"' + act("toggleRule", r.id) + ">" +
			'<i class="track"><span></span></i><b>' + esc(r.on ? t.ruleActive : t.ruleInactive) + "</b></button>" +
			'<div class="rule-body">' + sBody + "</div>" +
			'<div class="rule-end">' +
			'<button class="lvl ' + r.level + '"' + (bOff ? ' disabled=""' : "") + act("toggleRuleLevel", r.id) + ' title="' + esc(sLevel) + '" aria-label="' + esc(sLevel) + '">' + ic(r.level === "warn" ? "TriangleAlert" : "Info", 16) + "</button>" +
			'<button class="icon-btn"' + act("removeRule", r.id) + ' aria-label="' + esc(t.ruleRemove) + '" title="' + esc(t.ruleRemove) + '">' + ic("Trash2", 16) + "</button>" +
			"</div></li>";
	}

	function rulesModal(v) {
		var t = v.t;
		var aPeople = v.persons.slice().sort(function (x, y) { return x.name.localeCompare(y.name); }).map(function (p) { return { value: p.id, label: p.name }; });
		return '<div class="modal-backdrop" data-k="rules"' + act("closeRules") + ">" +
			'<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(t.rulesH) + '" data-stop="">' +
			'<div class="modal-head"><h2>' + esc(t.rulesH) + "</h2>" +
			'<button class="icon-btn"' + act("closeRules") + ' aria-label="' + esc(t.close) + '" title="' + esc(t.close) + '">' + ic("X", 18) + "</button></div>" +
			'<div class="modal-scroll">' +
			'<div class="rules-head"><p class="tile-note">' + esc(t.rulesSub) + "</p>" +
			select(v, {
				id: "addRule", className: "wide add-rule", align: "end", noClear: true, value: "", placeholder: t.addRule, label: t.addRule, action: "addRule",
				options: Checks.RULE_TYPES.map(function (k) { return { value: k, label: t.ruleTypes[k] }; })
			}) + "</div>" +
			(v.rules.length
				? '<ul class="rule-list-edit">' + v.rules.map(function (r) { return ruleRow(v, r, aPeople); }).join("") + "</ul>"
				: '<p class="rules-empty">' + esc(t.noRules) + "</p>") +
			"</div></div></div>";
	}

	function layoutBar(v) {
		var t = v.t;
		var oActive = v.activeVariant;
		return '<div class="layout-bar" role="toolbar" aria-label="' + esc(t.layoutH) + '" data-k="layoutbar">' +
			'<div class="lb-variants" role="group" aria-label="' + esc(t.variants) + '">' +
			[{ id: null, name: t.defaultVariant }].concat(v.variants).map(function (o) {
				if (v.renaming && v.renaming === o.id) {
					return '<input class="lb-rename" data-k="vr-' + esc(o.id) + '" value="' + esc(o.name) + '" maxlength="24" aria-label="' + esc(t.rename) + '" autocomplete="off"' +
						' data-af="rename-' + esc(o.id) + '" data-b="renameVariant" data-v="' + esc(o.id) + '" data-kd="rename">';
				}
				return '<button data-k="v-' + esc(o.id === null ? "default" : o.id) + '"' + on(v.activeId === o.id) + (o.id === null ? act("applyVariant") : act("applyVariant", o.id)) +
					(o.id ? ' data-dc="startRename"' : "") + pressed(v.activeId === o.id) + ">" + esc(o.name) +
					(v.activeId === o.id && v.layoutDirty ? '<i title="' + esc(t.changed) + '"></i>' : "") + "</button>";
			}).join("") + "</div>" +
			'<div class="lb-tools">' +
			'<button class="lb-icon"' + act("undoOrder") + (v.layoutPast.length ? "" : ' disabled=""') + ' aria-label="' + esc(t.undoOrder) + '" title="' + esc(t.undoOrder) + '">' + ic("Undo2", 18) + "</button>" +
			(oActive ? '<button class="lb-icon save"' + act("updateVariant") + (v.layoutDirty ? "" : ' disabled=""') + ' aria-label="' + esc(t.save) + '" title="' + esc(t.save) + '">' + ic("Save", 18) + "</button>" : "") +
			'<button class="lb-icon"' + act("saveVariantAs") + ' aria-label="' + esc(t.newVariant) + '" title="' + esc(t.newVariant) + '">' + ic("Plus", 18) + "</button>" +
			(oActive ? '<button class="lb-icon"' + act("startRename", oActive.id) + ' aria-label="' + esc(t.rename) + '" title="' + esc(t.rename) + '">' + ic("Pencil", 17) + "</button>" : "") +
			(oActive ? '<button class="lb-icon"' + act("deleteVariant") + ' aria-label="' + esc(t.deleteVariant) + '" title="' + esc(t.deleteVariant) + '">' + ic("Trash2", 18) + "</button>" : "") +
			'<button class="lb-done"' + act("layoutDone") + ">" + ic("Check", 16) + " " + esc(t.done) + "</button>" +
			"</div></div>";
	}

	function langButtons(v) {
		return '<div class="cp-lang" role="group" aria-label="Language">' +
			["de", "en", "ru"].map(function (l) {
				return "<button" + on(l === v.lang) + act("setLang", l) + pressed(l === v.lang) + ">" + l.toUpperCase() + "</button>";
			}).join("") + "</div>";
	}

	// the hints have no menu entry: the bell in the navbar leads there
	function notChecks(l) {
		return l.id !== "checks";
	}

	function navbar(v) {
		var t = v.t;
		return '<header class="cp-nav' + (v.scrolled ? " scrolled" : "") + '" data-k="nav">' +
			'<img class="cp-logo" src="' + esc(v.logo) + '" alt="alseda Consulting">' +
			'<div class="cp-nav-right">' +
			'<nav class="cp-nav-links" aria-label="' + esc(t.goTo) + '">' +
			v.sectionLinks.filter(notChecks).map(function (l) {
				return '<a href="#' + l.id + '"' + on(v.activeSec === l.id) + act("goTo", l.id) + ">" + esc(l.nav) + "</a>";
			}).join("") + "</nav>" +
			'<a class="cp-bell" href="#checks"' + act("goTo", "checks") + ' aria-label="' + esc(t.checksH + ": " + v.checks.length) + '" title="' + esc(t.checksH) + '">' + ic("Bell", 18) +
			(v.checks.length ? "<b" + (v.warns ? "" : ' class="calm"') + ">" + v.checks.length + "</b>" : "") + "</a>" +
			'<button class="cp-layout-btn' + (v.layoutEdit ? " on" : "") + '"' + act("toggleLayoutEdit") + pressed(v.layoutEdit) + ">" + ic("LayoutList", 16) + " <span>" + esc(t.layout) + "</span></button>" +
			langButtons(v) +
			'<button class="cp-menu-btn"' + act("openDrawer") + ' aria-label="' + esc(t.menu) + '" aria-haspopup="dialog" title="' + esc(t.menu) + '">' + ic("Menu", 20) + "</button>" +
			"</div></header>";
	}

	function socialLinks() {
		return '<a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">' + Icons.social("web") + "</a>" +
			'<a href="https://uk.linkedin.com/company/alseda-consulting" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">' + Icons.social("linkedin") + "</a>";
	}

	function drawer(v) {
		var t = v.t;
		return '<div class="drawer-backdrop' + (v.drawerClosing ? " closing" : "") + '" data-k="drawer"' + act("closeDrawer") + ">" +
			'<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(t.menu) + '" data-stop="">' +
			'<div class="drawer-head">' +
			'<img class="drawer-logo" src="' + esc(v.logo) + '" alt="alseda Consulting">' +
			'<strong class="drawer-title">' + esc(t.plannerMenu) + "</strong>" +
			'<button class="icon-btn"' + act("closeDrawer") + ' aria-label="' + esc(t.close) + '" title="' + esc(t.close) + '">' + ic("X", 18) + "</button></div>" +
			'<div class="drawer-scroll">' +
			'<nav class="drawer-links" aria-label="' + esc(t.goTo) + '">' +
			v.sectionLinks.filter(notChecks).map(function (l) {
				return '<a href="#' + l.id + '"' + on(v.activeSec === l.id) + act("drawerGoTo", l.id) + ">" + ic(l.icon, 18) + "<span>" + esc(l.label) + "</span><b>" + l.count + "</b></a>";
			}).join("") + "</nav>" +
			'<div class="drawer-actions">' +
			'<button class="ghost"' + act("drawerDo", "layout") + ">" + ic("LayoutList", 16) + " " + esc(t.layout) + "</button>" +
			'<button class="ghost"' + act("drawerDo", "rules") + ">" + ic("ListPlus", 16) + " " + esc(t.rulesBtn) + "</button></div>" +
			'<button class="btn-grad drawer-export"' + act("drawerDo", "export") + ">" + ic("Download", 16) + " " + esc(t.export) + "</button>" +
			"</div>" +
			'<div class="drawer-bottom"><div class="drawer-lang">' + langButtons(v) + "</div>" +
			'<div class="drawer-foot"><span>© ' + v.year + " " + esc(t.rights) + "</span>" + socialLinks() + "</div></div>" +
			"</aside></div>";
	}

	function hero(v) {
		var t = v.t;
		var aParts = t.title.split("Year-End");
		var sTitle = aParts.map(function (s, i) {
			return esc(s) + (i < aParts.length - 1 ? '<span style="white-space: nowrap">Year-End</span>' : "");
		}).join("");
		return '<div class="cp-hero" data-k="hero">' +
			'<div class="tile hero-main"><img class="hero-photo" src="' + esc(v.photo) + '" alt=""><h1>' + sTitle + "</h1><p>" + esc(t.sub) + "</p></div>" +
			'<div class="hero-side">' +
			'<div class="hero-holo lilac">' +
			'<p class="holo-label">' + esc(t.leg) + " " + (v.leg + 1) + " · " + esc(v.L.time) + " " + esc(t.oclock) + "</p>" +
			'<p class="holo-venue">' + esc(v.from) + " → " + esc(v.to) + "</p>" +
			'<p class="holo-addr">' + esc(v.L.to.addr) + "</p></div>" +
			'<div class="hero-holo green"><dl class="holo-facts">' +
			"<div><dt>" + esc(t.date) + "</dt><dd>" + esc(v.eventDate) + "</dd></div>" +
			"<div><dt>" + esc(t.depart) + "</dt><dd>" + esc(v.L.time) + " " + esc(t.oclock) + "</dd></div>" +
			"<div><dt>" + esc(t.persons) + "</dt><dd>" + v.onLeg + "</dd></div></dl>" +
			'<p class="holo-demo"><span>' + esc(t.demo) + "</span></p></div>" +
			"</div></div>";
	}

	function rulesTile(v) {
		var t = v.t;
		return '<section class="tile" data-k="rules-tile"><div class="rules"><div>' +
			'<h2 class="tile-title">' + esc(t.ruleH) + '</h2><p class="tile-note">' + esc(t.ruleSub) + "</p></div>" +
			'<div class="rule-list">' + t.rules.map(function (s, i) {
				return '<div class="rule"><span class="tick" style="background: ' + RULE_GRADS[i % RULE_GRADS.length] + '">' + ic("Check", 16, { strokeWidth: 3 }) + "</span><span>" + esc(s) + "</span></div>";
			}).join("") + "</div></div></section>";
	}

	function darkTile(v) {
		var t = v.t;
		return '<section class="tile dark" data-k="dark"><h2>' + esc(t.darkH(v.onLeg)) + "</h2><p>" + esc(v.from) + " → " + esc(v.to) + "</p>" +
			'<button class="btn-grad"' + act("exportPlan") + ">" + ic("Download", 16) + " " + esc(t.export) + "</button>" +
			"<small>" + esc(t.demo) + "</small></section>";
	}

	function footer(v) {
		return '<footer class="tile cp-foot" data-k="foot"><div class="foot-top">' +
			'<div class="foot-brand"><img class="cp-logo foot" src="' + esc(v.logo) + '" alt="alseda Consulting"></div>' +
			'<nav class="foot-links">' + socialLinks() + "</nav></div>" +
			'<div class="foot-bottom"><span>© ' + v.year + " " + esc(v.t.rights) + "</span></div></footer>";
	}

	// ---------- the whole page ----------
	function page(v) {
		var t = v.t;
		v.selects = {};
		var sCls = "cp" + (v.drag ? " dragging" : "") + (v.picked ? " picking" : "") + (v.layoutEdit ? " layout-editing" : "");
		return '<div class="' + sCls + '" data-k="cp" lang="' + v.lang + '">' +
			(v.note ? '<div class="toast" role="status" data-k="toast">' + esc(v.note) + "</div>" : "") +
			(v.pickedPerson
				? '<div class="pick-bar" role="status" data-k="pickbar"><span><strong>' + esc(v.pickedPerson.name) + "</strong> " + esc(t.picked) + "</span><button" + act("cancelPick") + ">" + esc(t.cancel) + "</button></div>"
				: "") +
			(v.drag ? '<div class="drag-ghost" data-k="ghost" style="left: ' + v.drag.x + "px; top: " + v.drag.y + 'px">' + esc(v.drag.person.name) + "</div>" : "") +
			(v.delAsk && v.byId[v.delAsk] ? confirmRemove(v) : "") +
			(v.conflict ? conflictDialog(v) : "") +
			(v.rulesOpen ? rulesModal(v) : "") +
			(v.layoutEdit ? layoutBar(v) : "") +
			navbar(v) +
			(v.drawerOpen ? drawer(v) : "") +
			'<div class="cp-wrap" data-k="wrap"><div class="cp-bento"><div class="cp-inner">' +
			hero(v) +
			v.sectionOrder.map(function (sKey, i) {
				return (v.layoutEdit ? moveBar(v, sKey, i) : "") + Section[sKey](v);
			}).join("") +
			rulesTile(v) + darkTile(v) + footer(v) +
			"</div></div></div></div>";
	}

	return {
		page: page,
		selectPopup: selectPopup,
		esc: esc
	};
});
