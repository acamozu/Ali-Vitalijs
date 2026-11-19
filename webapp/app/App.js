sap.ui.define([
	"./render",
	"./morph",
	"../model/agenda",
	"../model/clock",
	"../model/text",
	"../lib/qrcodegen",
	"sap/ui/dom/includeStylesheet"
], function (Render, Morph, Agenda, Clock, Text, qrcodegen, includeStylesheet) {
	"use strict";

	// The page of the web version (src/App.jsx) without React: one object keeps the state, render.js turns it into
	// markup and morph.js updates the DOM in place, so running animations and transitions survive an update.
	//
	//   QR page       shown first; the QR code opens the agenda page on a phone
	//   agenda page   route "agenda": the day as a list, with the current item highlighted and a live clock
	//
	// URL parameters, as in the web version: lang=de|en, layout=classic|cards|rings, now=10:40 (simulate a time on
	// the event day), today (treat today as the event day), nosplash, url=https://... (address in the QR code).
	// Fiori version only: local (do not call the SAP service), skin=inkwell (carpool look), event=<EventId>.

	var LANG_STORE = "agenda-lang";

	// loading screen: timing of the web version (src/Splash.jsx)
	var LETTER_STEP = 90; // ms between letters
	var LETTER_FADE = 900; // ms each letter takes to fade in
	var TITLE_FADE = 1400;
	var SPLASH_FADE = 700;

	var RELOAD_WAIT = 8000; // ms to wait for the SAP service before the built-in agenda is shown

	// parameters of the address: ?a=b of the page, and inside the Launchpad also those behind the intent (#Obj-action?a=b)
	function readQuery() {
		var oQuery = new URLSearchParams(window.location.search);
		var sHash = window.location.hash;
		var iAt = sHash.indexOf("?");
		if (iAt >= 0) {
			new URLSearchParams(sHash.slice(iAt + 1).split("&/")[0]).forEach(function (sValue, sKey) {
				if (!oQuery.has(sKey)) {
					oQuery.set(sKey, sValue);
				}
			});
		}
		return oQuery;
	}

	// which page: "#agenda" when the app runs alone, "#Obj-action&/agenda" inside the Launchpad
	function route() {
		var sHash = window.location.hash;
		return sHash === "#agenda" || /&\/agenda$/.test(sHash) ? "agenda" : "landing";
	}

	// address of the agenda page of this app (for the QR code)
	function ownAgendaUrl() {
		var sBase = window.location.origin + window.location.pathname + window.location.search;
		var aIntent = /^#([A-Za-z0-9_]+-[A-Za-z0-9_]+[^&]*)/.exec(window.location.hash); // Launchpad: "#Obj-action"
		return aIntent ? sBase + "#" + aIntent[1] + "&/agenda" : sBase + "#agenda";
	}

	function statusOf(oSlot, dNow) {
		if (dNow >= oSlot.end) { return "past"; }
		if (dNow >= oSlot.start) { return "current"; }
		return "upcoming";
	}

	// time ring / bar: past = full, upcoming = empty, current = share of the item that has passed
	function ringProgress(oSlot, sStatus, dNow) {
		if (sStatus === "past") { return 1; }
		if (sStatus === "upcoming") { return 0; }
		if (!oSlot.to) { return 1; } // last item has no end time: stays full while it runs
		return Math.min(1, Math.max(0, (dNow - oSlot.start) / (oSlot.end - oSlot.start)));
	}

	function fmt(d) {
		return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
	}

	// cubic-bezier(x1, y1, x2, y2) as a function of time (same maths as CSS easing)
	function cubicBezier(x1, y1, x2, y2) {
		var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
		var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
		var X = function (t) { return ((ax * t + bx) * t + cx) * t; };
		var Y = function (t) { return ((ay * t + by) * t + cy) * t; };
		var dX = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
		return function (x) {
			if (x <= 0) { return 0; }
			if (x >= 1) { return 1; }
			var t = x, i;
			for (i = 0; i < 8; i++) {
				var err = X(t) - x;
				if (Math.abs(err) < 1e-5) { return Y(t); }
				var d = dX(t);
				if (Math.abs(d) < 1e-6) { break; }
				t -= err / d;
			}
			var lo = 0, hi = 1;
			t = x;
			for (i = 0; i < 24; i++) {
				var v = X(t);
				if (Math.abs(v - x) < 1e-5) { break; }
				if (v < x) { lo = t; } else { hi = t; }
				t = (lo + hi) / 2;
			}
			return Y(t);
		};
	}

	// the QR code as SVG: the drawing of qrcode.react (level M with boost, no margin, one path for the dark modules)
	function qrSvg(sText) {
		var aRows = qrcodegen.QrCode.encodeSegments(qrcodegen.QrSegment.makeSegments(sText), qrcodegen.QrCode.Ecc.MEDIUM, 1).getModules();
		var n = aRows.length;
		var aOps = [];
		aRows.forEach(function (aRow, y) {
			var iStart = null;
			aRow.forEach(function (bCell, x) {
				if (!bCell && iStart !== null) {
					aOps.push("M" + iStart + " " + y + "h" + (x - iStart) + "v1H" + iStart + "z");
					iStart = null;
					return;
				}
				if (x === aRow.length - 1) {
					if (!bCell) {
						return;
					}
					if (iStart === null) {
						aOps.push("M" + x + "," + y + " h1v1H" + x + "z");
					} else {
						aOps.push("M" + iStart + "," + y + " h" + (x + 1 - iStart) + "v1H" + iStart + "z");
					}
					return;
				}
				if (bCell && iStart === null) {
					iStart = x;
				}
			});
		});
		return "<svg height=\"512\" width=\"512\" viewBox=\"0 0 " + n + " " + n + "\" role=\"img\">" +
			"<path fill=\"#FFFFFF\" d=\"M0,0 h" + n + "v" + n + "H0z\" shape-rendering=\"crispEdges\"></path>" +
			"<path fill=\"#000000\" d=\"" + aOps.join("") + "\" shape-rendering=\"crispEdges\"></path>" +
			"</svg>";
	}

	// oHost: the element UI5 rendered (class agHost). mOptions: { backend, logo, photo, splash, skin }
	function App(oHost, mOptions) {
		this.host = oHost;
		this.options = mOptions || {};
		this.query = readQuery();
		this.timers = [];
		this.cleanups = [];
		this.alive = false;
	}

	App.prototype.start = function () {
		var that = this;
		var q = this.query;
		var sLayout = q.get("layout");
		this.alive = true;
		this.reduced = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

		this.s = {
			lang: this._firstLang(),
			layout: ["classic", "cards", "rings"].indexOf(sLayout) >= 0 ? sLayout : "bands",
			demoToday: q.has("today"), // demo: treat today's date (Germany) as the event day
			sim: q.get("now"), // "10:40": simulate a time of day (rehearsal / testing)
			offset: 0, // device clock -> German internet time, see model/clock.js
			event: Agenda.EVENT,
			agenda: Agenda.AGENDA,
			textReady: false,
			dataReady: false,
			fontsOk: false,
			ready: this.options.splash === false, // loading screen gone
			route: null,
			phase: 2, // intro of the band list: 0 = running, 1 = real fill revealed under the overlay, 2 = done (live)
			scrolled: false,
			introHeight: 0
		};

		// carpool look: second stylesheet + its fonts, only when asked for
		var sSkin = this.options.skin || q.get("skin");
		if (sSkin === "inkwell") {
			this.host.classList.add("skin-inkwell");
			includeStylesheet(sap.ui.require.toUrl("com/alseda/agenda/css/fonts-skin.css"), "agenda-fonts-skin");
			includeStylesheet(sap.ui.require.toUrl("com/alseda/agenda/css/skin.css"), "agenda-skin");
		}

		this.host.innerHTML = "<div class=\"ag-scroll\"><div class=\"ag-page\"></div></div>";
		this.scroller = this.host.firstChild;
		this.page = this.scroller.firstChild;
		this.host.setAttribute("lang", this.s.lang);

		// height of the app area: the QR page fills exactly this (100vh would include the Launchpad shell bar)
		var fnSize = function () {
			that.host.style.setProperty("--ag-vh", that.host.clientHeight + "px");
		};
		fnSize();
		this._listen(window, "resize", fnSize);
		if (window.ResizeObserver) {
			var oObserver = new ResizeObserver(fnSize);
			oObserver.observe(this.host);
			this.cleanups.push(function () { oObserver.disconnect(); });
		}

		this._listen(window, "hashchange", function () { that.render(); });
		this._listen(this.host, "click", function (oEvent) { that._onClick(oEvent); });

		// texts (both languages), then the loading screen
		Text.load().then(function () {
			if (!that.alive) { return; }
			that.s.textReady = true;
			if (!that.s.ready) {
				that._showSplash();
			}
			that.render();
		});

		// the agenda: from the SAP service, else the built-in one
		var oBackend = q.has("local") ? null : this.options.backend;
		var pData = !oBackend ? Promise.resolve(null) : Promise.race([
			oBackend.load(),
			new Promise(function (resolve) { that._later(function () { resolve(null); }, RELOAD_WAIT); })
		]);
		pData.then(function (oData) {
			if (!that.alive) { return; }
			if (oData) {
				that.s.event = oData.event;
				that.s.agenda = oData.agenda;
			}
			that.s.source = oData ? "sap" : "built-in";
			that.host.setAttribute("data-source", that.s.source);
			that.s.dataReady = true;
			that.render();
		});

		// agenda clock: German time from the internet, re-synced every 5 minutes; the page is refreshed every 5 seconds
		var fnSync = function () {
			Clock.fetchOffset().then(function (o) {
				if (that.alive) {
					that.s.offset = o.offset;
					that.s.clockSource = o.source;
					that.render();
				}
			});
		};
		fnSync();
		this._every(fnSync, 5 * 60 * 1000);
		if (!this.s.sim) {
			this._every(function () { that.render(); }, 5000);
		}
	};

	// language: ?lang=en|de, else the last choice (localStorage), else German
	App.prototype._firstLang = function () {
		var sLang = this.query.get("lang");
		if (sLang === "de" || sLang === "en") {
			return sLang;
		}
		try {
			sLang = window.localStorage.getItem(LANG_STORE);
			if (sLang === "de" || sLang === "en") {
				return sLang;
			}
		} catch (e) {
			/* storage not available */
		}
		return "de";
	};

	App.prototype._setLang = function (sLang) {
		this.s.lang = sLang;
		this.host.setAttribute("lang", sLang);
		try {
			window.localStorage.setItem(LANG_STORE, sLang);
		} catch (e) {
			/* storage not available */
		}
		this.render();
	};

	App.prototype._onClick = function (oEvent) {
		var oTarget = oEvent.target;
		var oLang = oTarget.closest && oTarget.closest(".lang button[data-lang]");
		if (oLang) {
			this._setLang(oLang.getAttribute("data-lang"));
			return;
		}
		// live pill in the header: glide to the current item
		if (oTarget.closest && oTarget.closest(".ag-live")) {
			var oCurrent = this.page.querySelector("[data-cur]");
			if (oCurrent) {
				oCurrent.scrollIntoView({ block: "center", behavior: "smooth" });
			}
		}
	};

	// ---------- state -> view model ----------
	App.prototype._view = function () {
		var s = this.s;
		var iNow = Date.now() + s.offset;
		var sDate = s.demoToday ? Clock.berlinDate(iNow) : s.event.date;
		var sTz = s.demoToday ? Clock.berlinOffset(iNow) : s.event.tz;
		if (!this._slots || this._slotsFor !== sDate + sTz || this._slotsOf !== s.agenda) {
			this._slots = Agenda.buildSlots(s.agenda, sDate, sTz);
			this._slotsFor = sDate + sTz;
			this._slotsOf = s.agenda;
		}
		var aSlots = this._slots;
		var dNow = s.sim ? new Date(sDate + "T" + s.sim + ":00" + sTz) : new Date(iNow);
		var t = Text.TEXT[s.lang];
		var oLast = aSlots[aSlots.length - 1];
		var sStatus = "";
		if (dNow < aSlots[0].start) {
			sStatus = t.before(fmt(aSlots[0].start));
		} else if (dNow >= oLast.end) {
			sStatus = t.after;
		}
		return {
			lang: s.lang,
			t: t,
			event: s.event,
			year: String(s.event.date).slice(0, 4),
			thisYear: new Date().getFullYear(),
			slots: aSlots,
			now: dNow,
			layout: s.layout,
			phase: s.phase,
			introHeight: s.introHeight,
			demoToday: s.demoToday,
			ended: dNow >= oLast.end, // the whole programme is over
			status: sStatus,
			current: aSlots.filter(function (o) { return dNow >= o.start && dNow < o.end; })[0] || null,
			photo: this.options.photo,
			logo: this.options.logo,
			fmt: fmt,
			statusOf: function (o) { return statusOf(o, dNow); },
			ringProgress: function (o, st) { return ringProgress(o, st, dNow); }
		};
	};

	App.prototype.render = function () {
		var s = this.s;
		if (!this.alive || !s.textReady || !s.dataReady) {
			return;
		}
		var sRoute = route();
		if (sRoute !== s.route) {
			// a page is opened: the agenda page starts with its intro (band list, unless motion is reduced)
			this._stopIntro();
			s.route = sRoute;
			s.phase = sRoute === "agenda" && s.layout === "bands" && !this.reduced ? 0 : 2;
			s.scrolled = false;
			s.introHeight = 0;
			this.scroller.scrollTop = 0;
		}
		var v = this._view();
		this.v = v;
		if (sRoute === "agenda") {
			Morph.apply(this.page, Render.agenda(v));
		} else {
			// QR code: ?url=https://... or the public address kept with the event, else the address of this app
			var sBase = this.query.get("url") || s.event.publicUrl;
			var sTarget = sBase ? sBase + (sBase.indexOf("#") >= 0 ? "&/agenda" : "#agenda") : ownAgendaUrl();
			if (this._qrFor !== sTarget) {
				this._qr = qrSvg(sTarget);
				this._qrFor = sTarget;
			}
			v.qr = this._qr;
			// a click on the code opens the same address as scanning it (web addresses only)
			v.qrUrl = /^https?:\/\//i.test(sTarget) ? sTarget : "";
			Morph.apply(this.page, Render.landing(v));
		}
		this._awaitFonts();
		this._effects();
	};

	// The intro measures the rows, so it waits until the web font is in (otherwise rows reflow after the measurement).
	// Asked once the page is drawn: before that no text uses the font, and the browser would report "ready" at once.
	App.prototype._awaitFonts = function () {
		var that = this;
		if (this._fontsAsked) {
			return;
		}
		this._fontsAsked = true;
		var fnFonts = function () {
			if (that.alive && !that.s.fontsOk) {
				that.s.fontsOk = true;
				that._effects();
			}
		};
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(fnFonts, fnFonts);
		} else {
			fnFonts();
		}
		this._later(fnFonts, 1500); // never wait longer than this
	};

	// what has to happen after the page was drawn
	App.prototype._effects = function () {
		var s = this.s;
		if (!this.alive || s.route !== "agenda" || !s.dataReady || !s.textReady) {
			return;
		}
		// once, when the loading screen is gone and no intro runs: bring the current item into view
		if (s.ready && s.phase === 2 && !s.scrolled) {
			var oCurrent = this.page.querySelector("[data-cur]");
			if (oCurrent) {
				oCurrent.scrollIntoView({ block: "center", behavior: "smooth" });
				s.scrolled = true;
			}
		}
		if (s.ready && s.fontsOk && s.phase === 0 && !this._intro) {
			this._startIntro();
		}
	};

	App.prototype._setPhase = function (iPhase) {
		this.s.phase = iPhase;
		this.render();
	};

	// intro: when the page appears, the dot runs down the bar from the top and stops at the current time;
	// the page scrolls along with it
	App.prototype._startIntro = function () {
		var that = this;
		var s = this.s;
		var v = this.v;
		var oList = this.page.querySelector(".bd");
		var oFill = oList && oList.querySelector(".bd-fill");
		var oDot = oList && oList.querySelector(".bd-dot");
		if (!oList || !oFill || !oDot || !oFill.animate) {
			this._setPhase(2);
			return;
		}
		var aRows = Array.prototype.slice.call(oList.querySelectorAll(".bd-row"));
		var oListRect = oList.getBoundingClientRect();
		var aGeo = aRows.map(function (oRow) {
			var r = oRow.getBoundingClientRect();
			return { top: r.top - oListRect.top, h: r.height };
		});
		// where the dot has to stop: end of the last finished item, or inside the current one
		var iTarget = 0;
		v.slots.forEach(function (oSlot, i) {
			var st = v.statusOf(oSlot);
			if (st === "past") {
				iTarget = aGeo[i].top + aGeo[i].h;
			} else if (st === "current") {
				iTarget = aGeo[i].top + v.ringProgress(oSlot, st) * aGeo[i].h;
			}
		});
		if (v.statusOf(v.slots[v.slots.length - 1]) === "past") {
			// programme over: the dot rests fully inside the bottom end of the bar (not half cut off)
			var iBar = parseFloat(window.getComputedStyle(oList).getPropertyValue("--bar-w")) || 8;
			iTarget -= iBar * 0.875;
		}
		if (iTarget <= 0) {
			this._setPhase(2);
			return;
		}
		var iDuration = Math.min(3400, Math.max(1400, iTarget * 1.1));
		// the bar fill and the dot are transform animations: they run on the compositor and stay smooth
		var mTiming = { duration: iDuration, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" };
		s.introHeight = iTarget;
		oFill.setAttribute("style", "height:" + iTarget + "px");
		var oFillRun = oFill.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], mTiming);
		var oDotRun = oDot.animate([{ transform: "translateY(0px)" }, { transform: "translateY(" + iTarget + "px)" }], mTiming);

		// The page scrolls together with the dot: same easing and duration, one scroll step per frame.
		// (The app scrolls inside its own container: inside the Launchpad the window does not scroll.)
		var oScroller = this.scroller;
		var iListTop = oListRect.top - oScroller.getBoundingClientRect().top + oScroller.scrollTop;
		var iFrom = oScroller.scrollTop;
		var iFocus = iTarget;
		v.slots.forEach(function (oSlot, i) {
			if (v.statusOf(oSlot) === "current") {
				iFocus = aGeo[i].top + aGeo[i].h / 2; // same spot as the pill / centring
			}
		});
		var iMax = Math.max(0, oScroller.scrollHeight - oScroller.clientHeight);
		var iTo = Math.min(iMax, Math.max(0, iListTop + iFocus - oScroller.clientHeight / 2));
		s.scrolled = true; // this intro already centres the current item; skip the extra smooth scroll

		var fnEase = cubicBezier(0.65, 0, 0.35, 1); // same curve as the dot / bar animation
		var iStart = window.performance.now();
		var bStopped = false; // the visitor took over: stop moving the page
		var bFinished = false;
		var fnStop = function () { bStopped = true; };
		var aStopEvents = ["wheel", "touchstart", "keydown", "mousedown"];
		aStopEvents.forEach(function (sName) {
			window.addEventListener(sName, fnStop, { passive: true, once: true });
		});
		var iFrame = 0;
		var fnFollow = function (iTime) {
			if (bStopped) { return; }
			var k = Math.min(1, (iTime - iStart) / iDuration);
			oScroller.scrollTop = iFrom + (iTo - iFrom) * fnEase(k);
			if (k < 1) {
				iFrame = window.requestAnimationFrame(fnFollow);
			}
		};
		iFrame = window.requestAnimationFrame(fnFollow);

		this._intro = {
			stop: function () {
				window.cancelAnimationFrame(iFrame);
				aStopEvents.forEach(function (sName) { window.removeEventListener(sName, fnStop); });
				if (!bFinished) {
					oFillRun.cancel();
					oDotRun.cancel();
				}
			}
		};

		Promise.all([oFillRun.finished, oDotRun.finished]).then(function () {
			if (!that.alive || !that._intro) { return; }
			bFinished = true;
			window.cancelAnimationFrame(iFrame);
			if (!bStopped) {
				oScroller.scrollTop = iTo;
			}
			// phase 1: the real fill of every row is drawn underneath the overlay; the overlay goes a moment later
			that._setPhase(1);
			that._later(function () {
				if (that.s.phase === 1) {
					that._stopIntro();
					that._setPhase(2);
				}
			}, 120);
		}).catch(function () { /* cancelled */ });
	};

	App.prototype._stopIntro = function () {
		if (this._intro) {
			this._intro.stop();
			this._intro = null;
		}
	};

	// ---------- loading screen ----------
	App.prototype._showSplash = function () {
		var that = this;
		var v = this._view();
		var iBrandEnd = Array.from(v.event.company).length * LETTER_STEP + LETTER_FADE;
		var iTitleDelay = iBrandEnd + 150; // title starts right after the last letter
		var iDuration = iTitleDelay + TITLE_FADE + 1100; // hold a moment, then leave
		var oSplash = document.createElement("div");
		oSplash.className = "splash";
		oSplash.setAttribute("role", "presentation");
		oSplash.innerHTML = Render.splash(v, { letterStep: LETTER_STEP, letterFade: LETTER_FADE, titleDelay: iTitleDelay, titleFade: TITLE_FADE });
		this.host.appendChild(oSplash);
		this._later(function () { oSplash.classList.add("leaving"); }, iDuration);
		this._later(function () {
			if (oSplash.parentNode) {
				oSplash.parentNode.removeChild(oSplash);
			}
			that.s.ready = true;
			that._effects();
		}, iDuration + SPLASH_FADE);
	};

	// ---------- housekeeping ----------
	App.prototype._listen = function (oTarget, sName, fnHandler) {
		oTarget.addEventListener(sName, fnHandler);
		this.cleanups.push(function () { oTarget.removeEventListener(sName, fnHandler); });
	};

	App.prototype._later = function (fn, iMs) {
		var that = this;
		var iId = window.setTimeout(function () { if (that.alive) { fn(); } }, iMs);
		this.timers.push(function () { window.clearTimeout(iId); });
	};

	App.prototype._every = function (fn, iMs) {
		var iId = window.setInterval(fn, iMs);
		this.timers.push(function () { window.clearInterval(iId); });
	};

	App.prototype.destroy = function () {
		this.alive = false;
		this._stopIntro();
		this.timers.forEach(function (fn) { fn(); });
		this.cleanups.forEach(function (fn) { fn(); });
		this.timers = [];
		this.cleanups = [];
		this.host.innerHTML = "";
	};

	return App;
});
