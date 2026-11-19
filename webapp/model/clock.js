sap.ui.define([], function () {
	"use strict";

	// Agenda clock: the time comes from the internet (German time), not from the visitor's device.
	// Phones often run a few minutes off or in another time zone, which would shift the highlighted slot.

	var TZ = "Europe/Berlin";

	function fromPublicApi() {
		var t0 = Date.now();
		return fetch("https://worldtimeapi.org/api/timezone/" + TZ, { cache: "no-store" })
			.then(function (oRes) { return oRes.json(); })
			.then(function (oJson) {
				var t1 = Date.now();
				return { offset: new Date(oJson.utc_datetime).getTime() + (t1 - t0) / 2 - t1, source: "api" };
			});
	}

	// How far the device clock is off: Promise of { offset (ms, add to Date.now()), source }.
	function fetchOffset() {
		// 1) our own web server (on SAP: the ICM): its Date header is NTP-synced. A unique path avoids cached copies.
		var t0 = Date.now();
		return fetch("/__time?" + t0, { method: "HEAD", cache: "no-store" })
			.then(function (oRes) {
				var t1 = Date.now();
				var sDate = oRes.headers.get("date");
				if (!sDate) {
					throw new Error("no Date header");
				}
				// Netlify serves this 404 from its edge cache with a fresh Date header but an Age of hours, so adding Age
				// would put the clock hours ahead. Other CDNs send the original (old) Date plus the Age. Which one this is
				// can be told by the device clock: it is never hours off, so take the candidate closer to it.
				var iAge = Number(oRes.headers.get("age") || 0) * 1000;
				var iBase = new Date(sDate).getTime();
				var iMid = (t0 + t1) / 2;
				var iServer = iBase;
				if (iAge > 5000 && Math.abs(iBase + iAge - iMid) < Math.abs(iBase - iMid)) {
					iServer = iBase + iAge;
				}
				iServer += 500; // header has 1 s resolution: +0.5 s on average
				return { offset: iServer + (t1 - t0) / 2 - t1, source: "server" };
			})
			// 2) public time API for Europe/Berlin
			.catch(fromPublicApi)
			// 3) last resort: device clock
			.catch(function () {
				return { offset: 0, source: "device" };
			});
	}

	// "2026-11-06" for the given instant, as the calendar date in Germany
	function berlinDate(iMs) {
		return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(iMs);
	}

	// "+01:00" (winter) or "+02:00" (summer) for the given instant in Germany
	function berlinOffset(iMs) {
		try {
			var sPart = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
				.formatToParts(iMs)
				.filter(function (p) { return p.type === "timeZoneName"; })[0].value; // "GMT+1", "GMT+01:00" or "GMT"
			var m = sPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
			if (m) {
				return m[1] + (m[2].length < 2 ? "0" + m[2] : m[2]) + ":" + (m[3] || "00");
			}
			return "+00:00";
		} catch (e) {
			return "+01:00";
		}
	}

	return {
		fetchOffset: fetchOffset,
		berlinDate: berlinDate,
		berlinOffset: berlinOffset
	};
});
