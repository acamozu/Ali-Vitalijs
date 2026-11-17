sap.ui.define([
	"./morph",
	"./render",
	"../model/planner",
	"../model/checks",
	"../model/share",
	"../model/tags",
	"../model/state",
	"../model/text",
	"../model/icons"
], function (Morph, Render, Planner, Checks, Share, Tags, State, Text, Icons) {
	"use strict";

	// The planner itself: state, what is derived from it, and every action of the page.
	// One state object -> Render.page() -> Morph.apply() into the host element. The plan document (`hist.doc`:
	// persons, restBy, groupBy, limits, edits, rules) is what is saved and what undo / redo step through;
	// everything else is view state of this browser session.

	var LEGS = Planner.LEGS;
	var EVENT = Planner.EVENT;
	var DRAWER_MS = 320;
	var LOCALES = { de: "de-DE", en: "en-GB", ru: "ru-RU" };
	var SECTION_ICONS = { checks: "ListChecks", cars: "Car", tram: "Train", taxi: "CarTaxiFront", people: "Users", cards: "MessageSquareText" };

	// "RU", "ru", "ru-RU" or the one-letter SAP code "R" -> "ru"; anything the page has no texts for -> ""
	var SAP_LANG = { D: "de", E: "en", R: "ru" };
	function knownLang(v) {
		var s = String(v || "").trim();
		var sLang = s.length === 1 ? SAP_LANG[s.toUpperCase()] || "" : s.slice(0, 2).toLowerCase();
		return State.LANGS.indexOf(sLang) !== -1 ? sLang : "";
	}

	// The language the page starts in: URL parameter sap-language (the SAP way, e.g. from the run configuration or
	// the Launchpad URL), then ?lang, then the last choice in this browser, else German.
	function startLang() {
		var oQuery = new URLSearchParams(window.location.search);
		var sLang = knownLang(oQuery.get("sap-language")) || knownLang(oQuery.get("lang"));
		if (!sLang) {
			try {
				sLang = knownLang(window.localStorage.getItem("carpool-lang"));
			} catch (e) {
				/* storage not available */
			}
		}
		return sLang || "de";
	}

	function App(oHost, mOptions) {
		this.host = oHost;
		this.backend = mOptions.backend || null; // model/backend.js, or null: browser only
		this.logo = mOptions.logo;
		this.photo = mOptions.photo;
		this.splash = mOptions.splash !== false;

		var oSaved = State.loadState();
		this.s = {
			hist: { doc: State.initialDoc(oSaved), past: [], future: [] },
			lang: startLang(),
			leg: oSaved && oSaved.leg === 1 ? 1 : 0,
			filter: "all",
			tagFilter: null,
			newName: "",
			picked: null, // { car: boxId, idx } of the person chosen by tapping
			note: "", // short confirmation ("copied", "saved")
			layoutState: State.loadLayouts(), // { variants, activeId, order }
			layoutEdit: false,
			rulesOpen: false,
			renaming: null,
			drawerOpen: false,
			drawerClosing: false,
			delAsk: null,
			openRows: {},
			scrolled: false,
			activeSec: "",
			layoutPast: [],
			drag: null,
			selectOpen: null,
			conflict: null, // { by, at } while the "changed by someone else" question is open
			sync: this.backend ? "loading" : "local" // loading | saved | dirty | saving | error | local
		};
		this._savedDoc = this.s.hist.doc; // the document as the server has it
		this._memo = {};
		this._focused = {};
		this._lastDrag = 0;
		this._listeners = [];
	}

	// ---------- life cycle ----------
	App.prototype.start = function () {
		var that = this;
		this.root = document.createElement("div");
		this.root.className = "cp-root";
		this.host.appendChild(this.root);
		this.portal = document.createElement("div");
		this.portal.className = "cp-portal";
		document.body.appendChild(this.portal);

		// the texts come from the i18n files: the page is drawn once they are there
		Text.load().then(function () {
			if (that._destroyed) {
				return;
			}
			that._bind();
			that._applyLang();
			that.render();
			if (that.splash) {
				that._showSplash();
			}
			that._onScroll();

			if (that.backend) {
				that.backend.ready.then(function (bOk) {
					if (!bOk) {
						that.backend = null;
						that.set({ sync: "local" });
						return;
					}
					that._loadFromServer();
				});
			}
		}, function (oError) {
			jQuery.sap.log.error("carpool: the i18n files could not be read", oError && oError.message);
		});
	};

	App.prototype.destroy = function () {
		this._listeners.forEach(function (a) { a[0].removeEventListener(a[1], a[2], a[3]); });
		this._listeners = [];
		window.clearTimeout(this._noteTimer);
		window.clearTimeout(this._saveTimer);
		window.clearTimeout(this._drawerTimer);
		if (this.portal && this.portal.parentNode) {
			this.portal.parentNode.removeChild(this.portal);
		}
		if (this.root && this.root.parentNode) {
			this.root.parentNode.removeChild(this.root);
		}
		this._destroyed = true;
	};

	// ---------- state ----------
	App.prototype.set = function (mPatch) {
		var s = this.s;
		var sPlanKeyBefore = this.v ? this.v.planKey + "|" + s.leg : null;
		var sGroupBefore = s.hist.doc.groupBy;
		Object.keys(mPatch).forEach(function (k) { s[k] = mPatch[k]; });

		// one dialog at a time: opening any dialog drops a half-finished selection
		if (s.delAsk || s.rulesOpen || s.drawerOpen || s.conflict) {
			s.picked = null;
		}
		if (s.hist.doc.groupBy !== sGroupBefore) {
			s.tagFilter = null;
		}
		if ("note" in mPatch && s.note) {
			window.clearTimeout(this._noteTimer);
			this._noteTimer = window.setTimeout(function () { this.set({ note: "" }); }.bind(this), 2200);
		}
		this._planKeyBefore = sPlanKeyBefore;
		this._schedule();
	};

	App.prototype._schedule = function () {
		if (this._pending) {
			return;
		}
		this._pending = true;
		Promise.resolve().then(function () {
			this._pending = false;
			if (!this._destroyed) {
				this.render();
			}
		}.bind(this));
	};

	// change the plan document (goes on the undo stack and is saved)
	App.prototype.change = function (fn, mAlso) {
		var mPatch = mAlso || {};
		mPatch.hist = State.docReducer(this.s.hist, { type: "set", fn: fn });
		this.set(mPatch);
	};

	App.prototype.setField = function (sKey, v, mAlso) {
		this.change(function (d) {
			var vNew = typeof v === "function" ? v(d[sKey]) : v;
			if (vNew === d[sKey]) {
				return d;
			}
			var o = Object.assign({}, d);
			o[sKey] = vNew;
			return o;
		}, mAlso);
	};

	App.prototype.setDoc = function (mPatch) {
		this.change(function (d) { return Object.assign({}, d, mPatch); });
	};

	// ---------- what the page shows, derived from the state ----------
	App.prototype._layouts = function (oDoc) {
		if (this._memo.doc !== oDoc) {
			var persons = oDoc.persons;
			this._memo.doc = oDoc;
			this._memo.layouts = LEGS.map(function (_, l) {
				var sKey = State.structKeyOf(persons, l, oDoc.restBy, oDoc.groupBy);
				var e = oDoc.edits[l];
				if (e && e.key === sKey && e.layout) {
					var aRiders = persons.filter(function (p) { return p.legs[l] && !p.car; }).map(function (p) { return p.id; });
					return { key: sKey, layout: Planner.reconcileLayout(e.layout, aRiders, oDoc.limits, oDoc.restBy), away: persons.filter(function (p) { return !p.legs[l]; }).length };
				}
				var oPlan = Planner.planLeg(persons, l, oDoc.restBy, oDoc.limits, oDoc.groupBy);
				return { key: sKey, layout: Planner.baseLayout(oPlan, oDoc.limits), away: oPlan.away };
			});
			this._memo.checks = Checks.computeChecks({ persons: persons, layouts: this._memo.layouts, groupBy: oDoc.groupBy, limits: oDoc.limits, rules: oDoc.rules });
			var byId = {};
			persons.forEach(function (p) { byId[p.id] = p; });
			this._memo.byId = byId;
		}
		return this._memo.layouts;
	};

	// every placed person of a layout, in plan order, with label and role (assignment column)
	function entriesOf(oLayout, t) {
		var aOut = [];
		oLayout.order.cars.forEach(function (sId, n) {
			oLayout.boxes[sId].forEach(function (pid, i) {
				if (pid) { aOut.push({ pid: pid, kind: "car", label: t.car + " " + (n + 1), role: i === 0 ? t.driver : "" }); }
			});
		});
		oLayout.order.groups.forEach(function (sId, n) {
			oLayout.boxes[sId].forEach(function (pid) {
				if (pid) { aOut.push({ pid: pid, kind: "tram", label: t.group + " " + (n + 1), role: oLayout.buyers[sId] === pid ? t.buyer : "" }); }
			});
		});
		oLayout.order.taxis.forEach(function (sId, n) {
			oLayout.boxes[sId].forEach(function (pid) {
				if (pid) { aOut.push({ pid: pid, kind: "taxi", label: t.taxi + " " + (n + 1), role: "" }); }
			});
		});
		return aOut;
	}

	App.prototype._legHead = function (lg, l) {
		var t = Text.TEXT[this.s.lang];
		return (t.leg + " " + (l + 1) + " · " + lg.time + " " + t.oclock + " · " + lg.from.name[this.s.lang] + " → " + lg.to.name[this.s.lang]).replace("  ", " ");
	};

	App.prototype._syncView = function (x) {
		var s = this.s;
		var o = this.backend ? this.backend.info : { by: "", at: "" };
		switch (s.sync) {
			case "loading": return { state: "busy", text: x.loading, title: x.loading };
			case "saving": return { state: "busy", text: x.saving, title: x.saving };
			case "dirty": return { state: "busy", text: x.unsaved, title: x.unsaved };
			case "error": return { state: "bad", text: x.error, title: x.error, action: "retrySave" };
			case "saved": return { state: "ok", text: x.saved(o.at), title: x.savedTitle(o.by, o.at) };
			default: return { state: "off", text: x.local, title: x.localTitle };
		}
	};

	App.prototype._view = function () {
		var s = this.s;
		var d = s.hist.doc;
		var t = Text.TEXT[s.lang];
		var persons = d.persons;
		var layouts = this._layouts(d);
		var byId = this._memo.byId;
		var checks = this._memo.checks;
		var cur = layouts[s.leg];
		var layout = cur.layout;
		var L = LEGS[s.leg];
		var filterBy = d.groupBy === "none" ? "team" : d.groupBy;
		var tagInfo = Tags.tagColors(persons, filterBy);

		var aEntries = entriesOf(layout, t);
		var assignment = {};
		var count = { car: 0, tram: 0, taxi: 0 };
		aEntries.forEach(function (e) {
			assignment[e.pid] = e;
			count[e.kind]++;
		});
		var fnFilled = function (sId) { return layout.boxes[sId].filter(Boolean).length; };
		var sSearch = s.newName.trim().toLowerCase(); // the name box is also the search box
		var rows = persons.filter(function (p) {
			var a = assignment[p.id];
			if (sSearch && p.name.toLowerCase().indexOf(sSearch) === -1) { return false; }
			if (s.tagFilter && Planner.tagOf(p, filterBy) !== s.tagFilter) { return false; }
			if (s.filter === "all") { return true; }
			if (s.filter === "away") { return !p.legs[s.leg]; }
			if (s.filter === "driver") { return p.car && p.legs[s.leg]; }
			return !!a && a.kind === s.filter;
		});
		var that = this;
		var legCards = LEGS.map(function (lg, l) { return { lg: lg, l: l, cards: Share.buildCards(layouts[l].layout, byId, t) }; });

		var ls = s.layoutState;
		var activeVariant = null;
		ls.variants.forEach(function (o) { if (o.id === ls.activeId) { activeVariant = o; } });
		var SECTIONS = {
			checks: { id: "checks", label: t.checksH, nav: t.navChecks, count: checks.length },
			cars: { id: "cars", label: t.carsH, nav: t.navCars, count: count.car },
			tram: { id: "tram", label: t.tramH, nav: t.navTram, count: count.tram },
			taxi: { id: "taxi", label: t.taxiH, nav: t.navTaxi, count: count.taxi },
			people: { id: "all", label: t.allH, nav: t.navAll, count: persons.length },
			cards: { id: "cards", label: t.cardsH, nav: t.navCards, count: legCards[s.leg].cards.length }
		};
		var teamSet = {};
		persons.forEach(function (p) { if (p.team) { teamSet[p.team] = true; } });
		var oDate = new Date(EVENT.date + "T12:00:00");
		var oPickedPerson = s.picked && layout.boxes[s.picked.car] ? byId[layout.boxes[s.picked.car][s.picked.idx]] : null;

		return {
			t: t, x: Text.EXTRA[s.lang], lang: s.lang, leg: s.leg, L: L,
			from: L.from.name[s.lang], to: L.to.name[s.lang],
			persons: persons, restBy: d.restBy, groupBy: d.groupBy, limits: d.limits, rules: d.rules,
			layouts: layouts, layout: layout, planKey: cur.key, boxes: layout.boxes, order: layout.order, buyers: layout.buyers, times: layout.times || {},
			byId: byId, filterBy: filterBy, tagInfo: tagInfo,
			tagTitle: function (p) { return [p.team, p.lang].filter(Boolean).join(" · "); },
			assignment: assignment, count: count, checks: checks,
			warns: checks.filter(function (c) { return c.level === "warn"; }).length,
			teamList: Object.keys(teamSet).sort(function (a, b) { return a.localeCompare(b); }),
			legCards: legCards,
			total: count.car + count.tram + count.taxi,
			carMin: layout.order.cars.length,
			carMax: layout.order.cars.reduce(function (n, sId) { return n + layout.boxes[sId].length; }, 0),
			groupPeople: layout.order.groups.reduce(function (n, sId) { return n + fnFilled(sId); }, 0),
			tickets: layout.order.groups.filter(function (sId) { return fnFilled(sId) > 0; }).length,
			eventDate: oDate.toLocaleDateString(LOCALES[s.lang], { day: "numeric", month: "long", year: "numeric" }),
			eventDateShort: oDate.toLocaleDateString(LOCALES[s.lang]),
			onLeg: persons.length - cur.away,
			rows: rows,
			canUndo: s.hist.past.length > 0, canRedo: s.hist.future.length > 0,
			filter: s.filter, tagFilter: s.tagFilter, newName: s.newName, picked: s.picked, pickedPerson: oPickedPerson || null,
			note: s.note, drag: s.drag, delAsk: s.delAsk, conflict: s.conflict, rulesOpen: s.rulesOpen, openRows: s.openRows,
			layoutEdit: s.layoutEdit, renaming: s.renaming, drawerOpen: s.drawerOpen, drawerClosing: s.drawerClosing,
			scrolled: s.scrolled, activeSec: s.activeSec, layoutPast: s.layoutPast, selectOpen: s.selectOpen,
			variants: ls.variants, activeId: ls.activeId, sectionOrder: ls.order, activeVariant: activeVariant,
			layoutDirty: !State.sameOrder(ls.order, activeVariant ? activeVariant.order : State.SECTION_KEYS),
			sectionLinks: ls.order.map(function (k) {
				if (!SECTIONS[k]) { return null; }
				SECTIONS[k].icon = SECTION_ICONS[k];
				return SECTIONS[k];
			}).filter(Boolean),
			sync: that._syncView(Text.EXTRA[s.lang]),
			logo: this.logo, photo: this.photo, year: new Date().getFullYear()
		};
	};

	// ---------- render ----------
	App.prototype.render = function () {
		var s = this.s;
		var v = this._view();

		// a new plan structure or another leg drops the tap selection
		var sPlanKey = v.planKey + "|" + s.leg;
		if (s.picked && this._shownPlanKey && this._shownPlanKey !== sPlanKey) {
			s.picked = null;
			v = this._view();
		}
		this._shownPlanKey = sPlanKey;
		this.v = v;

		Morph.apply(this.root, Render.page(v));

		// while a dialog or the side menu is open the page behind it does not scroll
		var bLock = s.rulesOpen || s.drawerOpen || !!s.delAsk || !!s.conflict;
		this.host.style.overflow = bLock ? "hidden" : "";

		// fields that take the focus when they appear (dialog button, variant name)
		var mNow = {};
		var aFocus = this.root.querySelectorAll("[data-af]");
		for (var i = 0; i < aFocus.length; i++) {
			var sKey = aFocus[i].getAttribute("data-af");
			mNow[sKey] = true;
			if (!this._focused[sKey]) {
				aFocus[i].focus();
				if (aFocus[i].select) {
					aFocus[i].select();
				}
			}
		}
		this._focused = mNow;

		if (s.selectOpen && !v.selects[s.selectOpen]) {
			this._closeSelect();
		}
		this._persist();
	};

	// view preferences and a copy of the plan stay in this browser; the plan itself goes to the server
	App.prototype._persist = function () {
		var s = this.s;
		try {
			if (this._storedLayouts !== s.layoutState) {
				this._storedLayouts = s.layoutState;
				window.localStorage.setItem(State.LAYOUT_STORE, JSON.stringify(s.layoutState));
			}
			if (this._storedDoc !== s.hist.doc || this._storedLeg !== s.leg) {
				this._storedDoc = s.hist.doc;
				this._storedLeg = s.leg;
				window.localStorage.setItem(State.STORE, JSON.stringify(Object.assign({}, s.hist.doc, { leg: s.leg })));
			}
		} catch (e) {
			/* storage not available */
		}
		if (this.backend && this._loaded && s.hist.doc !== this._savedDoc && !s.conflict && s.sync !== "saving") {
			if (s.sync !== "dirty" && s.sync !== "error") {
				s.sync = "dirty";
				this._schedule();
			}
			if (s.sync === "dirty") {
				window.clearTimeout(this._saveTimer);
				this._saveTimer = window.setTimeout(this._save.bind(this, false), 1200);
			}
		}
	};

	// remember the language in this browser; after a switch (bToUrl) the URL parameter sap-language follows too,
	// so a reload or a copied link opens in the chosen language (the page is not reloaded for this)
	App.prototype._applyLang = function (bToUrl) {
		try {
			window.localStorage.setItem("carpool-lang", this.s.lang);
		} catch (e) {
			/* storage not available */
		}
		if (bToUrl) {
			try {
				var oUrl = new URL(window.location.href);
				oUrl.searchParams.set("sap-language", this.s.lang.toUpperCase());
				oUrl.searchParams.delete("lang");
				window.history.replaceState(window.history.state, "", oUrl.toString());
			} catch (e) {
				/* the address cannot be changed here */
			}
		}
	};

	// ---------- server ----------
	App.prototype._loadFromServer = function () {
		var that = this;
		return this.backend.load().then(function (o) {
			that._loaded = true;
			if (o) {
				// the server's plan replaces what this browser remembered; nothing to undo into
				var oDoc = State.initialDoc(o.doc);
				that._savedDoc = oDoc;
				that.set({ hist: { doc: oDoc, past: [], future: [] }, sync: "saved", conflict: null, picked: null });
			} else {
				// no plan on the server yet: the first change creates it
				that._savedDoc = null;
				that.set({ sync: "dirty" });
			}
		}, function () {
			// service is there but the read failed: keep working in the browser
			that.backend = null;
			that.set({ sync: "local" });
		});
	};

	App.prototype._save = function (bOverwrite) {
		var that = this;
		var oDoc = this.s.hist.doc;
		if (!this.backend || this._destroyed) {
			return;
		}
		window.clearTimeout(this._saveTimer);
		this.set({ sync: "saving" });
		this.backend.save(oDoc, bOverwrite).then(function () {
			that._savedDoc = oDoc;
			// changed again while the request was running: _persist() schedules the next save
			that.set({ sync: "saved" });
		}, function (oFail) {
			if (oFail && oFail.conflict) {
				that.backend.head().then(function (o) {
					that.set({ sync: "error", conflict: { by: o.by, at: o.at } });
				});
			} else {
				that.set({ sync: "error" });
			}
		});
	};

	// ---------- plan edits ----------
	// change the layout of the chosen leg by hand (fn gets a copy)
	App.prototype.editLayout = function (fn, mAlso) {
		var v = this.v;
		var iLeg = this.s.leg;
		var oCopy = { boxes: {}, order: { cars: v.order.cars.slice(), groups: v.order.groups.slice(), taxis: v.order.taxis.slice() }, buyers: Object.assign({}, v.buyers), times: Object.assign({}, v.times) };
		Object.keys(v.boxes).forEach(function (k) { oCopy.boxes[k] = v.boxes[k].slice(); });
		var oNext = Planner.fixBuyers(fn(oCopy) || oCopy);
		var sKey = v.planKey;
		this.setField("edits", function (mPrev) {
			var m = Object.assign({}, mPrev);
			m[iLeg] = { key: sKey, layout: oNext };
			return m;
		}, mAlso);
	};

	// move a person to a free place or swap two people (cars, tram groups, taxis); drivers never move
	App.prototype.swapSeats = function (a, b, mAlso) {
		if (State.isDriverPos(a) || State.isDriverPos(b)) {
			if (mAlso) { this.set(mAlso); }
			return;
		}
		this.editLayout(function (l) {
			var tmp = l.boxes[a.car][a.idx];
			l.boxes[a.car][a.idx] = l.boxes[b.car][b.idx];
			l.boxes[b.car][b.idx] = tmp;
		}, mAlso);
	};

	// tap a person, then a place: move or swap. Tapping the chosen one again cancels. Driver seats do nothing.
	App.prototype.onTap = function (pos, bHasPerson) {
		var picked = this.s.picked;
		if (Date.now() - this._lastDrag < 150) {
			return;
		}
		if (!picked) {
			if (bHasPerson && !State.isDriverPos(pos)) {
				this.set({ picked: pos });
			}
			return;
		}
		if (String(picked.car) === String(pos.car) && picked.idx === pos.idx) {
			this.set({ picked: null });
			return;
		}
		this.swapSeats(picked, pos, { picked: null });
	};

	App.prototype.patchPerson = function (sId, mChange) {
		this.setField("persons", function (ps) {
			return ps.map(function (p) { return p.id === sId ? Object.assign({}, p, mChange) : p; });
		});
	};

	App.prototype.changeRule = function (sId, mChange) {
		this.setField("rules", function (rs) {
			return rs.map(function (r) { return r.id === sId ? Object.assign({}, r, mChange) : r; });
		});
	};

	function download(oBlob, sName) {
		var sUrl = URL.createObjectURL(oBlob);
		var a = document.createElement("a");
		a.href = sUrl;
		a.download = sName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.setTimeout(function () { URL.revokeObjectURL(sUrl); }, 1000);
	}

	// the plan as an Excel workbook (overview, one sheet per leg, people with filters, hints)
	App.prototype.exportPlan = function () {
		var that = this;
		var v = this.v;
		var fnFail = function (e) {
			jQuery.sap.log.error("carpool export failed", e && e.message);
			window.alert(v.t.exportFailed);
		};
		sap.ui.require(["com/alseda/carpool/model/excel"], function (Excel) {
			Excel.buildWorkbook({ persons: v.persons, layouts: v.layouts, legs: LEGS, lang: v.lang, t: v.t, checks: v.checks, date: v.eventDateShort })
				.then(function (oBlob) { download(oBlob, "transfer-plan-" + EVENT.date + ".xlsx"); })
				.catch(fnFail);
		}, fnFail);
		return that;
	};

	// slides out first, removes the menu afterwards; fnAfter runs once it is gone
	App.prototype.closeDrawer = function (fnAfter) {
		var that = this;
		if (this.s.drawerClosing || !this.s.drawerOpen) {
			return;
		}
		this.set({ drawerClosing: true });
		this._drawerTimer = window.setTimeout(function () {
			that.set({ drawerOpen: false, drawerClosing: false });
			// after Esc the menu button would keep its keyboard focus ring and look stuck on hover
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
			if (typeof fnAfter === "function") {
				fnAfter();
			}
		}, DRAWER_MS);
	};

	App.prototype.goTo = function (sId, bFlash) {
		var el = this.root.querySelector("#" + sId);
		if (!el) {
			return;
		}
		el.scrollIntoView({ behavior: "smooth", block: "start" });
		if (bFlash) {
			el.classList.remove("flash");
			void el.offsetWidth;
			el.classList.add("flash");
			window.setTimeout(function () { el.classList.remove("flash"); }, 1600);
		}
	};

	// ---------- actions (data-a / data-i / data-b / data-c / data-s of the markup) ----------
	var CHECK_TARGET = { noPeople: "all", carNotThere: "all", emptyCar: "cars", freeSeats: "cars", mixed: "cars", smallGroup: "tram", lonelyTaxi: "taxi" };

	var Actions = {
		setLeg: function (el) { this.set({ leg: Number(el.getAttribute("data-v")) }); },
		setRestBy: function (el) { this.setField("restBy", el.getAttribute("data-v")); },
		setGroupBy: function (el) { this.setField("groupBy", el.getAttribute("data-v")); },
		exportPlan: function () { this.exportPlan(); },
		undo: function () { this.set({ hist: State.docReducer(this.s.hist, { type: "undo" }), picked: null }); },
		redo: function () { this.set({ hist: State.docReducer(this.s.hist, { type: "redo" }), picked: null }); },
		retrySave: function () { this._save(false); },

		savePlan: function () {
			var sJson = JSON.stringify({ app: "carpool", version: 1, saved: new Date().toISOString(), doc: this.s.hist.doc }, null, 1);
			download(new Blob([sJson], { type: "application/json" }), "carpool-plan-" + EVENT.date + ".json");
			this.set({ note: this.v.t.planSaved });
		},
		pickFile: function (el) {
			var oInput = this.root.querySelector('[data-file="' + el.getAttribute("data-v") + '"]');
			if (oInput) { oInput.click(); }
		},
		// leg 2 starts from the cars, groups and taxis of leg 1 (can be undone)
		copyLeg: function () {
			var d = this.s.hist.doc;
			var oLayout = Planner.copyLayoutToLeg(this.v.layouts[0].layout, d.persons, 1);
			var sKey = State.structKeyOf(d.persons, 1, d.restBy, d.groupBy);
			this.setField("edits", function (mPrev) {
				var m = Object.assign({}, mPrev);
				m[1] = { key: sKey, layout: oLayout };
				return m;
			}, { leg: 1, note: this.v.t.legCopied });
		},

		// how many go by car / tram / taxi: the mode that absorbs the change is the one the rest travels by
		setCounts: function (el) {
			var v = this.v;
			var sMode = el.getAttribute("data-v");
			var n = Number(el.getAttribute("data-w"));
			var car = v.count.car, tram = v.count.tram, taxi = v.count.taxi;
			var fnRest = function () { return v.total - car; };
			if (sMode === "car") {
				car = n;
				if (v.restBy === "taxi") {
					taxi = fnRest() - tram;
					if (taxi < 0) { taxi = 0; tram = fnRest(); }
				} else {
					tram = fnRest() - taxi;
					if (tram < 0) { tram = 0; taxi = fnRest(); }
				}
			} else if (sMode === "tram") {
				tram = n;
				taxi = fnRest() - tram;
			} else {
				taxi = n;
				tram = fnRest() - taxi;
			}
			var limits = v.limits;
			this.editLayout(function (l) { return Planner.applyCounts(l, { car: car, tram: tram, taxi: taxi }, limits); });
		},

		openRules: function () { this.set({ rulesOpen: true }); },
		closeRules: function () { this.set({ rulesOpen: false }); },
		goToCheck: function (el) {
			var that = this;
			var c = this.v.checks[Number(el.getAttribute("data-v"))];
			if (!c) { return; }
			var mKind = { car: "cars", group: "tram", taxi: "taxi" };
			var sRule = c.args.type === "person" || c.args.type === "note"
				? (c.args.rule === "noTaxi" ? "taxi" : c.args.rule === "noTram" ? "tram" : c.args.rule === "notAlone" ? mKind[c.args.kind] || "cars" : "cars")
				: "cars";
			var sTarget = c.code === "emptyBox" ? (c.args.kind === "group" ? "tram" : "taxi") : c.code === "rule" ? sRule : CHECK_TARGET[c.code] || "all";
			var bOther = c.leg !== this.s.leg;
			if (bOther) { this.set({ leg: c.leg }); }
			// wait one tick so the other leg is rendered before scrolling
			window.setTimeout(function () { that.goTo(sTarget, true); }, bOther ? 80 : 0);
		},

		tap: function (el) {
			var a = el.getAttribute("data-seat").split(":");
			this.onTap({ car: a[0], idx: Number(a[1]) }, !el.classList.contains("empty"));
		},
		cancelPick: function () { this.set({ picked: null }); },
		buyer: function (el) {
			var sGroup = el.getAttribute("data-v");
			var sPerson = el.getAttribute("data-w");
			this.editLayout(function (l) { l.buyers[sGroup] = sPerson; });
		},
		removeBox: function (el) {
			var sKind = el.getAttribute("data-v");
			var sId = el.getAttribute("data-w");
			this.editLayout(function (l) {
				if (l.boxes[sId].some(Boolean)) { return; }
				delete l.boxes[sId];
				l.order[sKind] = l.order[sKind].filter(function (x) { return x !== sId; });
			});
		},
		addBox: function (el) {
			var sKind = el.getAttribute("data-v");
			var limits = this.v.limits;
			this.editLayout(function (l) {
				var sId = Planner.newBoxId(l, sKind === "groups" ? "g" : "t");
				var n = sKind === "groups" ? limits.groupMax : limits.taxiSeats;
				l.boxes[sId] = [];
				for (var i = 0; i < n; i++) { l.boxes[sId].push(null); }
				l.order[sKind].push(sId);
			});
		},
		// set the number of tram groups: everybody in a group is spread evenly over the new number
		setGroupCount: function (el) {
			var n = Number(el.getAttribute("data-v"));
			var limits = this.v.limits;
			this.editLayout(function (l) {
				var aMembers = [];
				l.order.groups.forEach(function (g) { l.boxes[g].forEach(function (x) { if (x) { aMembers.push(x); } }); });
				var iTotal = aMembers.length;
				var aIds = l.order.groups.slice(0, n);
				l.order.groups.slice(n).forEach(function (g) { delete l.boxes[g]; });
				while (aIds.length < n) {
					var mTaken = Object.assign({}, l.boxes);
					aIds.forEach(function (sId) { mTaken[sId] = 0; });
					aIds.push(Planner.newBoxId({ boxes: mTaken }, "g"));
				}
				l.order.groups = aIds;
				aIds.forEach(function (g, i) {
					var iSize = Math.floor(iTotal / n) + (i < iTotal % n ? 1 : 0);
					var aMine = aMembers.splice(0, iSize);
					while (aMine.length < limits.groupMax) { aMine.push(null); }
					l.boxes[g] = aMine;
				});
			});
		},
		setLimit: function (el) {
			var n = Number(el.getAttribute("data-v"));
			var sKey = el.getAttribute("data-w");
			this.setField("limits", function (l) {
				var o = Object.assign({}, l);
				o[sKey] = n;
				return o;
			});
		},

		// ----- roster -----
		setCount: function (el) {
			var n = Number(el.getAttribute("data-v"));
			this.setField("persons", function (ps) {
				var aList = ps.slice();
				while (aList.length < n) { aList.push(Planner.newPerson(Planner.nextName(aList))); }
				while (aList.length > n) {
					// drop the last person without a car first
					var i = aList.map(function (p) { return p.car; }).lastIndexOf(false);
					aList.splice(i === -1 ? aList.length - 1 : i, 1);
				}
				return aList;
			});
		},
		submitAdd: function () {
			var sName = this.s.newName.trim();
			this.setField("persons", function (ps) { return ps.concat([Planner.newPerson(sName || Planner.nextName(ps))]); }, { newName: "" });
		},
		newName: function (el) { this.set({ newName: el.value }); },
		resetData: function () {
			if (!window.confirm(this.v.t.resetAsk)) { return; }
			this.setDoc({ persons: Planner.defaultPersons(), edits: {}, limits: Planner.DEFAULT_LIMITS, restBy: "tram", groupBy: "none", rules: [] });
		},
		setFilter: function (el) { this.set({ filter: el.getAttribute("data-v") }); },
		setTagFilter: function (el) { this.set({ tagFilter: el.hasAttribute("data-v") ? el.getAttribute("data-v") : null }); },
		toggleCar: function (el) {
			var p = this.v.byId[el.getAttribute("data-v")];
			this.patchPerson(p.id, { car: !p.car });
		},
		setSeats: function (el) { this.patchPerson(el.getAttribute("data-v"), { seats: Number(el.getAttribute("data-w")) }); },
		toggleLeg: function (el) {
			var p = this.v.byId[el.getAttribute("data-v")];
			var i = Number(el.getAttribute("data-w"));
			this.patchPerson(p.id, { legs: p.legs.map(function (b, j) { return j === i ? !b : b; }) });
		},
		toggleRow: function (el) {
			var m = Object.assign({}, this.s.openRows);
			var sId = el.getAttribute("data-v");
			m[sId] = !m[sId];
			this.set({ openRows: m });
		},
		note: function (el) {
			var p = this.v.byId[el.getAttribute("data-v")];
			var s = el.value.trim();
			if (p && s !== p.note) { this.patchPerson(p.id, { note: s }); }
		},
		askRemove: function (el) { this.set({ delAsk: el.getAttribute("data-v") }); },
		cancelRemove: function () { this.set({ delAsk: null }); },
		removeNow: function () {
			var sId = this.s.delAsk;
			this.setField("persons", function (ps) { return ps.filter(function (p) { return p.id !== sId; }); }, { delAsk: null });
		},
		// from a dropdown: mSel.arg = [person id, field]
		patchPerson: function (aArg, sValue) {
			var m = {};
			m[aArg[1]] = sValue;
			this.patchPerson(aArg[0], m);
		},

		loadFile: function (el) {
			var that = this;
			var t = this.v.t;
			var f = el.files && el.files[0];
			el.value = "";
			if (!f) { return; }
			var fnApply = function (sText) {
				var aList = Planner.parseRoster(sText);
				if (!aList.length) { return window.alert(t.csvEmpty); }
				if (window.confirm(t.replaceAsk(aList.length))) {
					// rules about named people no longer fit a new list
					that.setDoc({ persons: aList, edits: {}, rules: that.s.hist.doc.rules.filter(function (r) { return r.type !== "pair" && r.type !== "person"; }) });
				}
				return undefined;
			};
			// UTF-8 first; a German Excel saves "CSV" as windows-1252 (ä, ö, ü, ß are not valid UTF-8): then read it again that way
			var r = new FileReader();
			r.onload = function () {
				var sUtf8 = String(r.result);
				if (sUtf8.indexOf("�") === -1) { return fnApply(sUtf8); }
				var r2 = new FileReader();
				r2.onload = function () { fnApply(String(r2.result)); };
				r2.readAsText(f, "windows-1252");
				return undefined;
			};
			r.readAsText(f, "utf-8");
		},
		loadPlan: function (el) {
			var that = this;
			var t = this.v.t;
			var d = this.s.hist.doc;
			var f = el.files && el.files[0];
			el.value = "";
			if (!f) { return; }
			var fnBad = function () { window.alert(t.planBad); };
			if (/\.xlsx$/i.test(f.name)) {
				sap.ui.require(["com/alseda/carpool/model/excelImport"], function (Import) {
					Import.readPlanFromExcel(f, { legs: LEGS, limits: d.limits, keyOf: function (ps, l) { return State.structKeyOf(ps, l, d.restBy, d.groupBy); } }).then(function (res) {
						// rules about named people no longer fit the new list
						if (window.confirm(t.planAsk)) {
							that.setDoc({ persons: res.persons, edits: res.edits, rules: that.s.hist.doc.rules.filter(function (r) { return r.type !== "pair" && r.type !== "person"; }) });
						}
					}).catch(fnBad);
				}, fnBad);
				return;
			}
			var r = new FileReader();
			r.onload = function () {
				try {
					var o = JSON.parse(String(r.result));
					var ps = o && o.doc && o.doc.persons;
					if (!o || o.app !== "carpool" || !Array.isArray(ps) || !ps.every(function (p) { return p && p.id && p.name && Array.isArray(p.legs); })) {
						throw new Error("bad");
					}
					if (window.confirm(t.planAsk)) {
						that.change(function () { return State.initialDoc(o.doc); });
					}
				} catch (e) {
					fnBad();
				}
			};
			r.readAsText(f, "utf-8");
		},

		// ----- cards -----
		copyCards: function () {
			var that = this;
			var v = this.v;
			var sHead = this._legHead(v.L, v.leg);
			Share.copyText(v.legCards[v.leg].cards.map(function (c) { return Share.cardText(c, sHead, v.t); }).join("\n\n")).then(function (b) {
				that.set({ note: b ? v.t.copied : "" });
			});
		},
		copyCard: function (el) {
			var that = this;
			var v = this.v;
			var sId = el.getAttribute("data-v");
			var oCard = v.legCards[v.leg].cards.filter(function (c) { return c.id === sId; })[0];
			if (!oCard) { return; }
			Share.copyText(Share.cardText(oCard, this._legHead(v.L, v.leg), v.t)).then(function (b) {
				that.set({ note: b ? v.t.copied : "" });
			});
		},

		// ----- custom rules -----
		addRule: function (aArg, sType) { this.setField("rules", function (rs) { return rs.concat([Checks.newRule(sType)]); }); },
		setRuleField: function (aArg, sValue) {
			var m = {};
			m[aArg[1]] = aArg[1] === "max" ? Number(sValue) : sValue;
			this.changeRule(aArg[0], m);
		},
		toggleRule: function (el) {
			var sId = el.getAttribute("data-v");
			var r = this.v.rules.filter(function (x) { return x.id === sId; })[0];
			this.changeRule(sId, { on: !r.on });
		},
		toggleRuleLevel: function (el) {
			var sId = el.getAttribute("data-v");
			var r = this.v.rules.filter(function (x) { return x.id === sId; })[0];
			this.changeRule(sId, { level: r.level === "warn" ? "info" : "warn" });
		},
		removeRule: function (el) {
			var sId = el.getAttribute("data-v");
			this.setField("rules", function (rs) { return rs.filter(function (x) { return x.id !== sId; }); });
		},
		keyword: function (el) {
			var sId = el.getAttribute("data-v");
			var r = this.v.rules.filter(function (x) { return x.id === sId; })[0];
			if (r && el.value.trim() !== r.keyword) { this.changeRule(sId, { keyword: el.value.trim() }); }
		},

		// ----- departure time of a vehicle: "1450", "930" or "9" -> 14:50, 09:30, 09:00; empty = time of the leg -----
		timeFocus: function (el) { el.select(); },
		timeInput: function (el) {
			var d = el.value.replace(/\D/g, "").slice(0, 4);
			el.value = d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d;
			el.classList.remove("base");
		},
		time: function (el) {
			var v = this.v;
			var sId = el.getAttribute("data-v");
			var sNow = v.times[sId] || v.L.time;
			var d = el.value.replace(/\D/g, "");
			var sNew = sNow;
			if (!d) {
				sNew = v.L.time;
			} else {
				var hh = d.length <= 2 ? +d : d.length === 3 ? +d[0] : +d.slice(0, 2);
				var mm = d.length <= 2 ? 0 : +d.slice(d.length === 3 ? 1 : 2);
				if (hh < 24 && mm < 60) {
					sNew = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
				}
			}
			el.value = sNew;
			el.classList.toggle("base", sNew === v.L.time);
			if (sNew === sNow) { return; }
			var sBase = v.L.time;
			this.editLayout(function (l) {
				if (sNew === sBase) { delete l.times[sId]; } else { l.times[sId] = sNew; }
			});
		},

		// ----- navbar, side menu, section order -----
		setLang: function (el) {
			this.set({ lang: el.getAttribute("data-v") });
			this._applyLang(true);
		},
		goTo: function (el) { this.goTo(el.getAttribute("data-v")); },
		openDrawer: function () {
			window.clearTimeout(this._drawerTimer);
			this.set({ drawerClosing: false, drawerOpen: true });
		},
		closeDrawer: function () { this.closeDrawer(); },
		drawerGoTo: function (el) {
			var that = this;
			var sId = el.getAttribute("data-v");
			this.closeDrawer(function () { that.goTo(sId); });
		},
		drawerDo: function (el) {
			var that = this;
			var sWhat = el.getAttribute("data-v");
			this.closeDrawer(function () {
				if (sWhat === "layout") { that.set({ layoutEdit: true }); }
				if (sWhat === "rules") { that.set({ rulesOpen: true }); }
				if (sWhat === "export") { that.exportPlan(); }
			});
		},
		toggleLayoutEdit: function () { this.set({ layoutEdit: !this.s.layoutEdit }); },
		layoutDone: function () { this.set({ layoutEdit: false }); },
		moveSection: function (el) {
			var ls = this.s.layoutState;
			var i = Number(el.getAttribute("data-v"));
			var j = i + Number(el.getAttribute("data-w"));
			if (j < 0 || j >= ls.order.length) { return; }
			var o = ls.order.slice();
			var tmp = o[i];
			o[i] = o[j];
			o[j] = tmp;
			this.set({ layoutPast: this.s.layoutPast.slice(-30).concat([ls.order]), layoutState: Object.assign({}, ls, { order: o }) });
		},
		undoOrder: function () {
			var aPast = this.s.layoutPast;
			if (!aPast.length) { return; }
			this.set({ layoutPast: aPast.slice(0, -1), layoutState: Object.assign({}, this.s.layoutState, { order: aPast[aPast.length - 1] }) });
		},
		applyVariant: function (el) {
			var ls = this.s.layoutState;
			var sId = el.hasAttribute("data-v") ? el.getAttribute("data-v") : null;
			var oVar = ls.variants.filter(function (x) { return x.id === sId; })[0];
			this.set({
				layoutPast: this.s.layoutPast.slice(-30).concat([ls.order]),
				layoutState: Object.assign({}, ls, { activeId: oVar ? oVar.id : null, order: oVar ? oVar.order : State.SECTION_KEYS })
			});
		},
		// no question: the variant is named "Variante N" (next free number)
		saveVariantAs: function () {
			var ls = this.s.layoutState;
			var t = this.v.t;
			var aNames = ls.variants.map(function (o) { return o.name; });
			var n = ls.variants.length + 1;
			while (aNames.indexOf(t.variant + " " + n) !== -1) { n++; }
			var sId = "v" + Date.now().toString(36);
			this.set({ layoutState: Object.assign({}, ls, { variants: ls.variants.concat([{ id: sId, name: t.variant + " " + n, order: ls.order }]), activeId: sId }), renaming: sId });
		},
		updateVariant: function () {
			var ls = this.s.layoutState;
			if (!this.v.activeVariant) { return; }
			this.set({
				layoutState: Object.assign({}, ls, { variants: ls.variants.map(function (o) { return o.id === ls.activeId ? Object.assign({}, o, { order: ls.order }) : o; }) }),
				note: this.v.t.variantSaved
			});
		},
		startRename: function (el) { this.set({ renaming: el.getAttribute("data-v") }); },
		renameVariant: function (el) {
			var ls = this.s.layoutState;
			var sId = el.getAttribute("data-v");
			var sName = el.value.trim();
			if (this.s.renaming !== sId) { return; } // cancelled with Esc
			this.set({
				renaming: null,
				layoutState: sName ? Object.assign({}, ls, { variants: ls.variants.map(function (o) { return o.id === sId ? Object.assign({}, o, { name: sName }) : o; }) }) : ls
			});
		},
		deleteVariant: function () {
			var ls = this.s.layoutState;
			if (!this.v.activeVariant) { return; }
			this.set({ layoutState: Object.assign({}, ls, { variants: ls.variants.filter(function (o) { return o.id !== ls.activeId; }), activeId: null }) });
		},

		// ----- someone else saved in between -----
		conflictReload: function () { this._loadFromServer(); },
		conflictOverwrite: function () {
			this.set({ conflict: null });
			this._save(true);
		},

		select: function (el) { this._openSelect(el.getAttribute("data-v"), el); }
	};

	App.prototype._run = function (sName, el, oEvent) {
		if (Actions[sName]) {
			Actions[sName].call(this, el, oEvent);
		}
	};

	// ---------- dropdown overlay ----------
	App.prototype._openSelect = function (sId, elTrigger) {
		if (this.s.selectOpen === sId) {
			this._closeSelect();
			return;
		}
		var mSel = this.v.selects[sId];
		if (!mSel || mSel.disabled) {
			return;
		}
		var aItems = mSel.noClear ? mSel.options : [{ value: "__none", label: "–" }].concat(mSel.options);
		var iHigh = -1;
		aItems.forEach(function (o, i) { if (o.value === mSel.value && mSel.value !== "") { iHigh = i; } });
		this._sel = { id: sId, def: mSel, items: aItems, high: iHigh, trigger: elTrigger };
		this.set({ selectOpen: sId, picked: null });
		this._drawSelect();
	};

	App.prototype._drawSelect = function () {
		var o = this._sel;
		if (!o) {
			return;
		}
		var el = this.portal.firstChild;
		if (!el) {
			el = document.createElement("div");
			el.className = "select__positioner";
			el.style.position = "fixed";
			this.portal.appendChild(el);
		}
		Morph.apply(el, Render.selectPopup(o.def, o.high));
		this._placeSelect();
	};

	// below the trigger, as wide as the trigger; start or end aligned
	App.prototype._placeSelect = function () {
		var o = this._sel;
		var el = this.portal.firstChild;
		if (!o || !el) {
			return;
		}
		if (!document.body.contains(o.trigger)) {
			o.trigger = this.root.querySelector('.select__trigger[data-v="' + o.id.replace(/"/g, '\\"') + '"]');
			if (!o.trigger) {
				this._closeSelect();
				return;
			}
		}
		var r = o.trigger.getBoundingClientRect();
		el.style.setProperty("--anchor-width", r.width + "px");
		el.style.setProperty("--available-height", Math.max(120, window.innerHeight - r.bottom - 12) + "px");
		el.style.top = (r.bottom + 4) + "px";
		if (o.def.align === "end") {
			el.style.left = "auto";
			el.style.right = Math.max(0, window.innerWidth - r.right) + "px";
		} else {
			el.style.right = "auto";
			el.style.left = r.left + "px";
		}
	};

	App.prototype._closeSelect = function () {
		this._sel = null;
		while (this.portal.firstChild) {
			this.portal.removeChild(this.portal.firstChild);
		}
		if (this.s.selectOpen) {
			this.set({ selectOpen: null });
		}
	};

	App.prototype._chooseSelect = function (i) {
		var o = this._sel;
		if (!o || !o.items[i]) {
			return;
		}
		var sValue = o.items[i].value === "__none" ? "" : o.items[i].value;
		var mDef = o.def;
		var elTrigger = o.trigger;
		this._closeSelect();
		if (elTrigger && elTrigger.focus) {
			elTrigger.focus();
		}
		if (Actions[mDef.action]) {
			Actions[mDef.action].call(this, mDef.arg, sValue);
		}
	};

	// ---------- drag with the mouse (touch uses tap-to-select) ----------
	App.prototype._seatAt = function (x, y) {
		var el = document.elementFromPoint(x, y);
		el = el && el.closest ? el.closest("[data-seat]") : null;
		if (!el) {
			return null;
		}
		var a = el.getAttribute("data-seat").split(":");
		return { car: a[0], idx: Number(a[1]), el: el };
	};

	App.prototype._startDrag = function (e, elSeat) {
		var that = this;
		if (e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0)) {
			return;
		}
		var a = elSeat.getAttribute("data-seat").split(":");
		var from = { car: a[0], idx: Number(a[1]) };
		var person = this.v.byId[this.v.boxes[from.car][from.idx]];
		var st = { active: false, sx: e.clientX, sy: e.clientY, over: null };
		var fnMark = function (oOver) {
			if (st.over && st.over.el) { st.over.el.classList.remove("is-over"); }
			st.over = oOver;
			if (oOver && !(String(oOver.car) === String(from.car) && oOver.idx === from.idx)) { oOver.el.classList.add("is-over"); }
		};
		var fnMove, fnUp, fnCleanup;
		fnCleanup = function () {
			window.removeEventListener("pointermove", fnMove);
			window.removeEventListener("pointerup", fnUp);
			window.removeEventListener("pointercancel", fnCleanup);
			fnMark(null);
			if (st.active) {
				that._lastDrag = Date.now();
			}
			st.active = false;
			if (that.s.drag) {
				that.set({ drag: null });
			}
		};
		fnMove = function (ev) {
			if (!st.active) {
				if (Math.hypot(ev.clientX - st.sx, ev.clientY - st.sy) <= 5) { return; }
				st.active = true;
				// a drag cancels a tap selection
				that.s.drag = { car: from.car, idx: from.idx, person: person, x: ev.clientX, y: ev.clientY };
				that.s.picked = null;
				that.render();
				return;
			}
			// the name follows the pointer without a re-render
			that.s.drag.x = ev.clientX;
			that.s.drag.y = ev.clientY;
			var elGhost = that.root.querySelector(".drag-ghost");
			if (elGhost) {
				elGhost.style.left = ev.clientX + "px";
				elGhost.style.top = ev.clientY + "px";
			}
			fnMark(that._seatAt(ev.clientX, ev.clientY));
		};
		fnUp = function (ev) {
			var over = st.active ? that._seatAt(ev.clientX, ev.clientY) : null;
			fnCleanup();
			if (over && !(String(over.car) === String(from.car) && over.idx === from.idx)) {
				that.swapSeats(from, { car: over.car, idx: over.idx });
			}
		};
		window.addEventListener("pointermove", fnMove);
		window.addEventListener("pointerup", fnUp);
		window.addEventListener("pointercancel", fnCleanup);
	};

	// ---------- DOM events ----------
	App.prototype._on = function (oTarget, sType, fn, vOptions) {
		var fnBound = fn.bind(this);
		oTarget.addEventListener(sType, fnBound, vOptions);
		this._listeners.push([oTarget, sType, fnBound, vOptions]);
	};

	App.prototype._onScroll = function () {
		var that = this;
		if (this._raf) {
			return;
		}
		this._raf = window.requestAnimationFrame(function () {
			that._raf = 0;
			if (that._destroyed) { return; }
			var iTop = that.host.getBoundingClientRect().top;
			// in the Launchpad the shell bar lies above the app: menu and dialogs start below it (css/host.css)
			that.host.style.setProperty("--cp-top", Math.max(0, Math.round(iTop)) + "px");
			var sCur = "";
			["checks", "cars", "tram", "taxi", "all", "cards"].forEach(function (sId) {
				var el = that.root.querySelector("#" + sId);
				if (el && el.getBoundingClientRect().top - iTop <= 140) { sCur = sId; }
			});
			var bScrolled = that.host.scrollTop > 8;
			if (bScrolled !== that.s.scrolled || sCur !== that.s.activeSec) {
				that.set({ scrolled: bScrolled, activeSec: sCur });
			}
			that._placeSelect();
		});
	};

	App.prototype._bind = function () {
		var root = this.root;

		this._on(root, "click", function (e) {
			var el = e.target.closest ? e.target.closest("[data-a],[data-stop]") : null;
			if (e.target.closest && e.target.closest("a[href^='#']")) {
				e.preventDefault(); // in the Launchpad the hash belongs to the shell
			}
			if (!el || !el.hasAttribute("data-a") || !root.contains(el)) {
				return;
			}
			if (el.disabled) {
				return;
			}
			this._run(el.getAttribute("data-a"), el, e);
		});
		this._on(root, "dblclick", function (e) {
			var el = e.target.closest ? e.target.closest("[data-dc]") : null;
			if (el) { this._run(el.getAttribute("data-dc"), el, e); }
		});
		this._on(root, "input", function (e) {
			var s = e.target.getAttribute && e.target.getAttribute("data-i");
			if (s) { this._run(s, e.target, e); }
		});
		this._on(root, "change", function (e) {
			var s = e.target.getAttribute && e.target.getAttribute("data-c");
			if (s) { this._run(s, e.target, e); }
		});
		this._on(root, "focusin", function (e) {
			var s = e.target.getAttribute && e.target.getAttribute("data-f");
			if (s) { this._run(s, e.target, e); }
		});
		this._on(root, "focusout", function (e) {
			var s = e.target.getAttribute && e.target.getAttribute("data-b");
			if (s) { this._run(s, e.target, e); }
		});
		this._on(root, "submit", function (e) {
			var el = e.target.closest ? e.target.closest("[data-s]") : null;
			e.preventDefault();
			if (el) { this._run(el.getAttribute("data-s"), el, e); }
		});
		this._on(root, "pointerdown", function (e) {
			var el = e.target.closest ? e.target.closest("[data-drag]") : null;
			if (el && !e.target.closest(".buy")) { this._startDrag(e, el); }
		});
		this._on(root, "contextmenu", function (e) {
			if (e.target.closest && e.target.closest("[data-drag]")) { e.preventDefault(); }
		});
		this._on(root, "keydown", function (e) {
			var el = e.target;
			var sKind = el.getAttribute && el.getAttribute("data-kd");
			if (sKind) {
				if (e.key === "Enter") {
					el.blur();
				} else if (e.key === "Escape" && sKind === "time") {
					el.value = this.v.times[el.getAttribute("data-v")] || this.v.L.time;
					el.blur();
				} else if (e.key === "Escape" && sKind === "rename") {
					e.stopPropagation();
					this.set({ renaming: null });
				}
				return;
			}
			// seats, places and hints act like buttons
			if ((e.key === "Enter" || e.key === " ") && el.getAttribute && el.getAttribute("role") === "button" && el.hasAttribute("data-a")) {
				e.preventDefault();
				this._run(el.getAttribute("data-a"), el, e);
			}
		});

		// the list of an open dropdown lives outside the page element
		this._on(this.portal, "click", function (e) {
			var el = e.target.closest ? e.target.closest("[data-opt]") : null;
			if (el) { this._chooseSelect(Number(el.getAttribute("data-opt"))); }
		});
		this._on(this.portal, "pointermove", function (e) {
			var el = e.target.closest ? e.target.closest("[data-opt]") : null;
			if (el && this._sel && this._sel.high !== Number(el.getAttribute("data-opt"))) {
				this._sel.high = Number(el.getAttribute("data-opt"));
				this._drawSelect();
			}
		});
		this._on(document, "pointerdown", function (e) {
			if (!this._sel) { return; }
			if (this.portal.contains(e.target) || (e.target.closest && e.target.closest(".select__trigger") === this._sel.trigger)) { return; }
			this._closeSelect();
		}, true);

		this._on(window, "keydown", function (e) {
			var o = this._sel;
			if (o) {
				// an open dropdown is the top layer: it gets the keys first
				var n = o.items.length;
				if (e.key === "ArrowDown" || e.key === "ArrowUp") {
					e.preventDefault();
					o.high = e.key === "ArrowDown" ? Math.min(n - 1, o.high + 1) : Math.max(0, o.high - 1);
					this._drawSelect();
					var elHigh = this.portal.querySelector("[data-highlighted]");
					if (elHigh && elHigh.scrollIntoView) { elHigh.scrollIntoView({ block: "nearest" }); }
				} else if (e.key === "Home" || e.key === "End") {
					e.preventDefault();
					o.high = e.key === "Home" ? 0 : n - 1;
					this._drawSelect();
				} else if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					if (o.high >= 0) { this._chooseSelect(o.high); }
				} else if (e.key === "Escape" || e.key === "Tab") {
					if (e.key === "Escape") { e.preventDefault(); }
					this._closeSelect();
				}
				return;
			}
			if (e.key === "Escape") {
				if (this.s.picked) { this.set({ picked: null }); }
				if (this.s.rulesOpen || this.s.drawerOpen || this.s.delAsk) {
					this.set({ rulesOpen: false, delAsk: null });
					this.closeDrawer();
				}
				return;
			}
			if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
				return;
			}
			var k = e.key.toLowerCase();
			if (k === "z" && !e.shiftKey) {
				e.preventDefault();
				this._run("undo");
			} else if (k === "y" || (k === "z" && e.shiftKey)) {
				e.preventDefault();
				this._run("redo");
			}
		});

		this._on(this.host, "scroll", this._onScroll, { passive: true });
		this._on(window, "resize", this._onScroll);
	};

	// ---------- loading screen in the style of the live agenda ----------
	App.prototype._showSplash = function () {
		var that = this;
		var BRAND = EVENT.company;
		var LETTER_STEP = 60;
		var LETTER_FADE = 750;
		var BRAND_END = 300 + (BRAND.length - 1) * LETTER_STEP + LETTER_FADE; // the last letter is in
		var TITLE_START = BRAND_END; // only now the page name and the road appear
		var TITLE_DELAY = TITLE_START - 300;
		var TITLE_FADE = 900;
		var ROAD_START = TITLE_START + TITLE_FADE + 100; // the road comes only once the page name is fully there
		var DRIVE_DELAY = ROAD_START + 250; // then the car drives off
		var DRIVE = 1900; // the car crosses the road in this time, at a constant speed
		var DASH_MS = Math.round(DRIVE * 0.0932); // one dash period: the road lines flow at the same speed as the roadside light
		var DURATION = DRIVE_DELAY + DRIVE + 150; // about 5.3 s in all
		var FADE = 700;
		var sAnim = function (iDelay, iDuration) {
			return ' style="animation-delay: ' + iDelay + "ms" + (iDuration === undefined ? "" : "; animation-duration: " + iDuration + "ms") + '"';
		};

		var el = document.createElement("div");
		el.className = "cp-splash";
		el.setAttribute("role", "presentation");
		el.innerHTML =
			'<h1 class="cp-s-brand" aria-label="' + Render.esc(BRAND) + '">' +
			BRAND.split("").map(function (ch, i) {
				return '<span aria-hidden="true" class="cp-s-letter"' + sAnim(300 + i * LETTER_STEP, LETTER_FADE) + ">" + (ch === " " ? " " : Render.esc(ch)) + "</span>";
			}).join("") + "</h1>" +
			'<p class="cp-s-title"' + sAnim(300 + TITLE_DELAY, TITLE_FADE) + ">" + Render.esc(Text.EXTRA[this.s.lang].appTitle) + " <b>2026</b></p>" +
			'<div class="cp-road" aria-hidden="true"' + sAnim(ROAD_START) + ">" + Icons.splashCity() +
			'<svg class="cp-road-svg" viewBox="0 0 400 93" preserveAspectRatio="none"><line x1="0" y1="2" x2="400" y2="2"></line><line x1="0" y1="91" x2="400" y2="91"></line>' +
			'<line class="cp-road-mid" x1="0" y1="46.5" x2="400" y2="46.5" pathLength="100"' + sAnim(DRIVE_DELAY, DASH_MS) + "></line></svg>" +
			'<svg class="cp-tl" viewBox="0 0 14 34" aria-hidden="true"' + sAnim(DRIVE_DELAY, DRIVE) + '><line x1="7" y1="24" x2="7" y2="34"></line><rect x="1" y="1" width="12" height="23" rx="2.5" fill="#fff"></rect>' +
			'<circle cx="7" cy="6" r="2.6" fill="#fff"></circle><circle cx="7" cy="12.5" r="2.6" fill="#fff"></circle><circle cx="7" cy="19" r="2.6" fill="#fff"></circle><circle cx="7" cy="19" r="2.6" fill="#000"></circle></svg>' +
			'<svg class="cp-road-car" viewBox="0 0 60 30" aria-hidden="true"' + sAnim(DRIVE_DELAY, DRIVE) + '><polygon points="2,23 2,16 10,14 16,5 38,5 46,14 57,16 58,23"></polygon>' +
			'<polygon points="18,7.5 25,7.5 25,13.5 13.5,13.5"></polygon><polygon points="28,7.5 36.5,7.5 41,13.5 28,13.5"></polygon><line x1="26.5" y1="14" x2="26.5" y2="23"></line>' +
			'<rect x="53" y="17" width="4" height="3"></rect><rect x="2" y="17" width="3" height="3"></rect><circle cx="15" cy="23" r="5.2"></circle><circle cx="46" cy="23" r="5.2"></circle>' +
			'<rect x="14" y="22" width="2" height="2" fill="#000"></rect><rect x="45" y="22" width="2" height="2" fill="#000"></rect></svg>' +
			"</div>";
		this.host.appendChild(el);
		window.setTimeout(function () { el.classList.add("leaving"); }, DURATION);
		window.setTimeout(function () {
			if (el.parentNode) { el.parentNode.removeChild(el); }
			that._splashDone = true;
		}, DURATION + FADE);
	};

	return App;
});
