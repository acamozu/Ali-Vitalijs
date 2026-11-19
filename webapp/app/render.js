sap.ui.define([
	"../model/icons"
], function (Icons) {
	"use strict";

	// The markup of the page: same structure and class names as the web version (src/App.jsx, src/Splash.jsx),
	// so the stylesheet of the web version applies unchanged. Every function returns an HTML string for the view
	// model `v` that app/App.js builds; app/morph.js brings the page in line with it.
	// "data-k" marks elements that come and go, so morph.js matches them by name instead of by position.

	var RING_R = 44;
	var RING_C = 2 * Math.PI * RING_R;

	function esc(v) {
		return String(v === null || v === undefined ? "" : v)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	function maps(sQuery) {
		return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(sQuery);
	}

	function langSwitch(v, sClass) {
		return "<div class=\"lang " + (sClass || "") + "\" role=\"group\" aria-label=\"Language\">" +
			["de", "en"].map(function (l) {
				return "<button type=\"button\" aria-pressed=\"" + (v.lang === l) + "\" data-lang=\"" + l + "\">" + l.toUpperCase() + "</button>";
			}).join("") +
			"</div>";
	}

	// same footer on the QR page (pinned to the bottom) and on the agenda page (after the list)
	function footer(v, sClass) {
		return "<footer class=\"" + sClass + "\">" +
			"<small class=\"lf-copy\">" +
			"<img class=\"lf-logo\" src=\"" + esc(v.logo) + "\" alt=\"" + esc(v.event.company) + "\">" +
			"<span>\u00a9 " + v.thisYear + " " + esc(v.t.rights) + "</span>" +
			"</small>" +
			"<nav class=\"lf-links\">" +
			"<a href=\"https://alseda.eu/\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"alseda.eu\" title=\"alseda.eu\">" + Icons.web() + "</a>" +
			"<a href=\"https://uk.linkedin.com/company/alseda-consulting\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"LinkedIn\" title=\"LinkedIn\">" + Icons.linkedIn() + "</a>" +
			"</nav>" +
			"</footer>";
	}

	// ---------- QR page ----------
	function landing(v) {
		return "<main class=\"landing\">" +
			"<img class=\"landing-photo\" src=\"" + esc(v.photo) + "\" alt=\"\">" +
			langSwitch(v, "lang-corner") +
			"<div class=\"landing-inner\">" +
			"<div class=\"landing-text\">" +
			"<p class=\"eyebrow\">" + esc(v.event.company) + "</p>" +
			"<h1>" + esc(v.event.title) + " <span>" + v.year + "</span></h1>" +
			"<p class=\"date\">" + esc(v.t.dateLong(v.event.date)) + "<br>" + esc(v.event.venue) + (v.event.city ? ", " + esc(v.event.city) : "") + "</p>" +
			"</div>" +
			"<div class=\"landing-qr\">" +
			// a link to the address in the code: on a laptop without a camera a click does what scanning does
			(v.qrUrl
				? "<a class=\"qr\" href=\"" + esc(v.qrUrl) + "\" aria-label=\"" + esc(v.t.openAgenda) + "\">" + v.qr + "</a>"
				: "<div class=\"qr\" role=\"img\" aria-label=\"" + esc(v.t.scan) + "\">" + v.qr + "</div>") +
			"<p class=\"hint\">" + esc(v.t.scan) + "</p>" +
			"</div>" +
			"</div>" +
			footer(v, "landing-footer") +
			"</main>";
	}

	// ---------- parts of the agenda rows ----------
	function minutesLeft(v, s) {
		return Math.max(1, Math.ceil((s.end - v.now) / 60000));
	}

	function progress(v, s) {
		var n = Math.min(100, Math.max(0, ((v.now - s.start) / (s.end - s.start)) * 100));
		return "<div class=\"r-progress\"><i style=\"width:" + n + "%\"></i></div>";
	}

	function ring(v, s, st) {
		return "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\">" +
			"<circle class=\"ring-track\" cx=\"50\" cy=\"50\" r=\"" + RING_R + "\"></circle>" +
			"<circle class=\"ring-fill\" cx=\"50\" cy=\"50\" r=\"" + RING_R + "\" style=\"stroke-dasharray:" + RING_C + ";stroke-dashoffset:" + (RING_C * (1 - v.ringProgress(s, st))) + "\"></circle>" +
			"</svg>";
	}

	// speaker / location line with the small icon in front
	function meta(sClass, sIcon, iSize, sText) {
		return "<p class=\"" + sClass + "\">" + Icons.icon(sIcon, iSize) + esc(sText) + "</p>";
	}

	// ---------- the four layouts of the list ----------
	function classic(v) {
		return "<ol class=\"ag-list\">" + v.slots.map(function (s, i) {
			var st = v.statusOf(s);
			var bCurrent = st === "current";
			return "<li data-k=\"r" + s.id + "\"" + (bCurrent ? " data-cur=\"1\"" : "") + " class=\"row " + s.type + " " + st + " " + (i % 2 === 0 ? "left" : "right") + "\">" +
				"<div class=\"r-when\">" +
				"<time>" + v.fmt(s.start) + "</time>" +
				(s.hasEnd && s.type !== "break" ? "<span>" + s.minutes + " " + esc(v.t.min) + "</span>" : "") +
				"</div>" +
				"<div class=\"r-node\" aria-hidden=\"true\"><span class=\"bubble\">" + Icons.icon(s.icon, s.type === "break" ? 15 : 20) + "</span></div>" +
				"<div class=\"r-body\">" +
				(bCurrent ? "<p class=\"r-tag\">" + esc(v.t.now) + " \u00b7 " + esc(v.t.left(minutesLeft(v, s))) + "</p>" : "") +
				"<p class=\"r-title\">" + esc(s.title[v.lang]) + "</p>" +
				(s.subtitle ? "<p class=\"r-sub\">" + esc(s.subtitle[v.lang]) + "</p>" : "") +
				(s.speaker ? meta("r-meta r-line", "user", 14, s.speaker) : "") +
				(s.location ? meta("r-meta r-line", "pin", 14, s.location) : "") +
				(bCurrent ? progress(v, s) : "") +
				"</div>" +
				"</li>";
		}).join("") + "</ol>";
	}

	function cards(v) {
		// parts: a new part starts with every item that has a section
		var aParts = [];
		v.slots.forEach(function (s, i) {
			if (s.section || !aParts.length) {
				aParts.push({ section: s.section, items: [] });
			}
			aParts[aParts.length - 1].items.push({ s: s, i: i });
		});
		return aParts.map(function (p, pi) {
			return "<section data-k=\"p" + pi + "\" class=\"cd-part part-" + pi + "\">" +
				"<h2 class=\"cd-section\">" + esc(p.section ? p.section[v.lang] : "") + "</h2>" +
				"<ol class=\"cd\">" + p.items.map(function (o) {
					var s = o.s;
					var st = v.statusOf(s);
					var bCurrent = st === "current";
					return "<li data-k=\"r" + s.id + "\"" + (bCurrent ? " data-cur=\"1\"" : "") + " class=\"cd-row " + s.type + " " + st + " " + (o.i % 2 === 0 ? "left" : "right") + "\">" +
						(s.type === "break"
							? "<div class=\"cd-break\">" + Icons.icon(s.icon, 15) + "<time>" + v.fmt(s.start) + "</time><span>" + esc(s.title[v.lang]) + "</span></div>"
							: "<div class=\"cd-card\">" +
								"<span class=\"cd-badge\">" + ring(v, s, st) +
								"<span class=\"cd-time\"><b>" + v.fmt(s.start) + "</b>" + (s.hasEnd ? "<small>" + s.minutes + " " + esc(v.t.min) + "</small>" : "") + "</span>" +
								"</span>" +
								"<div class=\"cd-text\">" +
								(bCurrent ? "<p class=\"cd-when\">" + esc(v.t.now) + " \u00b7 " + esc(v.t.left(minutesLeft(v, s))) + "</p>" : "") +
								"<p class=\"cd-title\">" + esc(s.title[v.lang]) + "</p>" +
								(s.subtitle ? "<p class=\"cd-sub\">" + esc(s.subtitle[v.lang]) + "</p>" : "") +
								(s.speaker ? meta("cd-meta", "user", 15, s.speaker) : "") +
								(s.location ? meta("cd-meta", "pin", 15, s.location) : "") +
								(bCurrent ? progress(v, s) : "") +
								"</div>" +
								"</div>") +
						"</li>";
				}).join("") + "</ol>" +
				"</section>";
		}).join("");
	}

	function rings(v) {
		return "<ol class=\"rg\">" + v.slots.map(function (s, i) {
			var st = v.statusOf(s);
			var bCurrent = st === "current";
			return "<li data-k=\"r" + s.id + "\"" + (bCurrent ? " data-cur=\"1\"" : "") + " class=\"rg-row " + s.type + " " + st + " " + (i % 2 === 0 ? "left" : "right") + "\">" +
				"<div class=\"rg-text\">" +
				(bCurrent ? "<p class=\"r-tag\">" + esc(v.t.now) + "</p>" : "") +
				"<p class=\"rg-title\">" + esc(s.title[v.lang]) + "</p>" +
				(s.subtitle ? "<p class=\"rg-sub\">" + esc(s.subtitle[v.lang]) + "</p>" : "") +
				(s.speaker ? meta("rg-meta", "user", 15, s.speaker) : "") +
				(s.location ? meta("rg-meta", "pin", 15, s.location) : "") +
				(bCurrent ? progress(v, s) : "") +
				"</div>" +
				"<div class=\"rg-node\"><span class=\"rg-ring\">" + ring(v, s, st) +
				"<span class=\"rg-time\"><b>" + v.fmt(s.start) + "</b>" +
				(bCurrent && s.to
					? "<small class=\"rg-left\">" + minutesLeft(v, s) + " " + esc(v.t.min) + "</small>"
					: "<small>" + (s.to ? s.minutes + " " + esc(v.t.min) : esc(v.t.openEnd)) + "</small>") +
				"</span>" +
				"</span></div>" +
				"</li>";
		}).join("") + "</ol>";
	}

	// default: joined bands with a centre bar that fills as the day goes
	function bands(v) {
		return "<ol class=\"bd " + (v.phase < 2 ? "intro" : "") + " " + (v.ended ? "ended" : "") + "\">" + v.slots.map(function (s, i) {
			var st = v.statusOf(s);
			var bCurrent = st === "current";
			var sSub = bCurrent && s.to ? v.t.left(minutesLeft(v, s)) : s.to ? s.minutes + " " + v.t.min : v.t.openEnd;
			return "<li data-k=\"r" + s.id + "\"" + (bCurrent ? " data-cur=\"1\"" : "") +
				" class=\"bd-row " + s.type + " " + st + " " + (i % 2 === 0 ? "left" : "right") + " " + (v.ended && i === v.slots.length - 1 ? "last-ended" : "") + "\"" +
				" style=\"--rp:" + (v.phase === 0 ? 0 : v.ringProgress(s, st)) + "\">" +
				"<div class=\"bd-time\"><b>" + v.fmt(s.start) + "</b><small class=\"" + (bCurrent ? "bd-left" : "") + "\">" + esc(sSub) + "</small></div>" +
				"<div class=\"bd-axis\" aria-hidden=\"true\"><span class=\"bd-now\"></span></div>" +
				"<div class=\"bd-text\">" +
				(bCurrent ? "<p class=\"r-tag\">" + esc(v.t.now) + "</p>" : "") +
				"<p class=\"bd-title\">" + esc(s.title[v.lang]) + "</p>" +
				(s.subtitle ? "<p class=\"bd-sub\">" + esc(s.subtitle[v.lang]) + "</p>" : "") +
				(s.speaker ? meta("bd-meta", "user", 15, s.speaker) : "") +
				(s.location
					? "<p class=\"bd-meta\"><a class=\"bd-map\" href=\"" + esc(maps(s.location)) + "\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"" + esc(s.location) + " \u2013 Google Maps\"><span>" + esc(s.location) + "</span></a></p>"
					: "") +
				"</div>" +
				"</li>";
		}).join("") +
			// intro: one bar fill + one dot above the rows, moved by app/App.js
			(v.phase < 2
				? "<li data-k=\"overlay\" class=\"bd-overlay\" aria-hidden=\"true\"><span class=\"bd-fill\"" + (v.introHeight ? " style=\"height:" + v.introHeight + "px\"" : "") + "></span><span class=\"bd-dot\"></span></li>"
				: "") +
			"</ol>";
	}

	// ---------- agenda page ----------
	function agenda(v) {
		var c = v.current;
		return "<main class=\"ag\">" +
			"<header class=\"ag-hero\">" +
			"<img class=\"ag-hero-art\" src=\"" + esc(v.photo) + "\" alt=\"\">" +
			"<div class=\"ag-hero-inner\">" +
			"<div class=\"ag-hero-text\">" +
			"<p class=\"ag-brand\">" + esc(v.event.company) + "</p>" +
			"<h1>" + esc(v.event.title) + " " + v.year + "</h1>" +
			"<p class=\"ag-meta\">" + esc(v.t.dateLong(v.event.date)) + "<br>" + esc(v.event.venue) + "<br>" +
			"<a class=\"ag-addr\" href=\"" + esc(maps(v.event.venue + ", " + v.event.address)) + "\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"" + esc(v.event.address) + " \u2013 Google Maps\">" + esc(v.event.address) + "</a>" +
			"</p>" +
			langSwitch(v, "") +
			(v.status ? "<p data-k=\"status\" class=\"ag-status\">" + esc(v.status) + "</p>" : "") +
			(c
				? "<button data-k=\"live\" type=\"button\" class=\"ag-live\">" +
					"<span class=\"ag-live-now\"><i aria-hidden=\"true\"></i>" + esc(v.t.now) + "<span class=\"ag-live-colon\">:</span></span>" +
					"<span class=\"ag-live-text\">" + esc(c.title[v.lang]) + "</span>" +
					"<span class=\"ag-live-left\">" + esc(v.t.left(minutesLeft(v, c))) + "</span>" +
					"</button>"
				: "") +
			(v.demoToday ? "<p data-k=\"demo\" class=\"ag-demo\">" + v.fmt(v.now) + "</p>" : "") +
			"</div>" +
			"</div>" +
			"</header>" +
			(v.layout === "classic" ? classic(v) : v.layout === "cards" ? cards(v) : v.layout === "rings" ? rings(v) : bands(v)) +
			footer(v, "landing-footer ag-footer") +
			"</main>";
	}

	// ---------- loading screen ----------
	// brand: letter by letter; then the title line. The timing is passed in by app/App.js.
	function splash(v, o) {
		var sBrand = v.event.company;
		return "<h1 class=\"s-brand\" aria-label=\"" + esc(sBrand) + "\">" +
			Array.from(sBrand).map(function (ch, i) {
				return "<span aria-hidden=\"true\" class=\"letter\" style=\"animation-delay:" + (300 + i * o.letterStep) + "ms;animation-duration:" + o.letterFade + "ms\">" + (ch === " " ? "\u00a0" : esc(ch)) + "</span>";
			}).join("") +
			"</h1>" +
			"<p class=\"s-title\" style=\"animation-delay:" + (300 + o.titleDelay) + "ms;animation-duration:" + o.titleFade + "ms\">" +
			"<span class=\"s-welcome\">" + esc(v.t.welcome) + "</span>" + esc(v.event.title) + " <b>" + v.year + "</b>" +
			"</p>";
	}

	return {
		landing: landing,
		agenda: agenda,
		splash: splash
	};
});
