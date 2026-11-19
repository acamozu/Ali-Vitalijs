sap.ui.define([], function () {
	"use strict";

	// Agenda data of the alseda Consulting Year-End Conference, 27 Nov 2026 (Frankfurt, CET = +01:00).
	// In the Fiori version the agenda is kept in the SAP system (OData service ZAGENDA_SRV, see model/backend.js).
	// The data below is the same agenda as in the web version (src/agenda.js); it is shown when the service cannot
	// be reached (local start without SAP, URL parameter ?local).

	var EVENT = {
		title: "Year-End Conference",
		company: "alseda Consulting",
		date: "2026-11-27",
		tz: "+01:00",
		venue: "JW Marriott, Salon I",
		city: "Frankfurt",
		address: "Thurn-und-Taxis-Platz 2, 60313 Frankfurt",
		publicUrl: ""
	};

	// type: session | break | social
	// "to" is optional: if missing, the item ends when the next one starts
	// title / subtitle / section are { de, en }; location is a plain address
	var AGENDA = [
		{ section: { de: "Konferenz", en: "Conference" }, icon: "coffee", from: "09:00", to: "09:30", type: "break", title: { de: "Willkommens\u00adkaffee & Snacks", en: "Welcome Coffee & Snacks" } },
		{ icon: "hand", from: "09:30", to: "10:30", type: "session", title: { de: "Offizielle Begr\u00fc\u00dfung", en: "Official Welcome" }, speaker: "Frank" },
		{ icon: "coffee", from: "10:30", to: "10:45", type: "break", title: { de: "Pause \u2013 Referenten\u00adwechsel", en: "Break \u2013 Speaker Change" } },
		{ icon: "chart", from: "10:45", to: "11:15", type: "session", title: { de: "Projekt\u00adausblick 2027", en: "Project Prospects 2027" }, speaker: "Oliver" },
		{ icon: "coffee", from: "11:15", to: "11:30", type: "break", title: { de: "Pause \u2013 Referenten\u00adwechsel", en: "Break \u2013 Speaker Change" } },
		{ icon: "gauge", from: "11:30", to: "12:00", type: "session", title: { de: "Load & Performance in SAP PE & TRBK", en: "Load & Performance in SAP PE & TRBK" }, speaker: "David / Julian" },
		{ icon: "chat", from: "12:00", to: "12:30", type: "session", title: { de: "Marketing Insights: Reflect, Connect & Celebrate", en: "Marketing Insights: Reflect, Connect & Celebrate" }, speaker: "Loredana" },
		{ icon: "food", from: "12:30", to: "14:00", type: "break", title: { de: "Pause \u2013 Mittagessen", en: "Break \u2013 Lunch" } },
		{ icon: "chip", from: "14:00", to: "14:30", type: "session", title: { de: "KI-Live-Demo", en: "AI Live Demo" }, speaker: "Vitalijs / Ali" },
		{
			icon: "coin", from: "14:30", to: "15:00", type: "session",
			title: { de: "Stablecoins: Hype oder Zukunft des Zahlungs\u00adverkehrs?", en: "Stablecoins: Hype or the Future of Payments?" },
			subtitle: { de: "SAP Pay & alseda \u2013 R\u00fcckblick 2026 und Ausblick 2027", en: "SAP Pay & alseda \u2013 Review 2026 and Outlook 2027" },
			speaker: "Michael"
		},
		{
			section: { de: "Weihnachts\u00adfeier", en: "Christmas Party" },
			icon: "star", from: "15:00", type: "social",
			title: { de: "Beginn der Weihnachts\u00adfeier", en: "Start of the Christmas Party" },
			subtitle: { de: "Transfer zum ehemaligen Polizei\u00adpr\u00e4sidium", en: "Transfer to the Former Police Headquarters" },
			location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main"
		},
		{
			icon: "pin", from: "16:00", to: "18:00", type: "social",
			title: { de: "Gef\u00fchrte Lost-Places-Tour", en: "Guided Lost Places Tour" },
			subtitle: { de: "\u201eAltes Polizei\u00adpr\u00e4sidium Frankfurt\u201c", en: "\u201cOld Police Headquarters Frankfurt\u201d" },
			location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main"
		},
		{
			icon: "bus", from: "18:00", type: "social",
			title: { de: "Transfer zum Casa Isoletta", en: "Transfer to Casa Isoletta" },
			location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main",
			subtitle: { de: "Vom Alten Polizei\u00adpr\u00e4sidium Frankfurt", en: "From the Old Police Headquarters Frankfurt" }
		},
		{
			icon: "food", from: "19:00", type: "social",
			title: { de: "Abendessen im Casa Isoletta", en: "Dinner at Casa Isoletta" },
			location: "Babenh\u00e4user Landstra\u00dfe 1, 60599 Frankfurt am Main"
		}
	];

	// resolve start / end Dates for a given calendar day; open-ended items end where the next begins (last: +3h)
	function buildSlots(aAgenda, sDate, sTz) {
		var toDate = function (sTime) {
			return new Date(sDate + "T" + sTime + ":00" + sTz);
		};
		return aAgenda.map(function (a, i) {
			var oNext = aAgenda[i + 1];
			var dStart = toDate(a.from);
			var dEnd = a.to ? toDate(a.to) : oNext ? toDate(oNext.from) : new Date(dStart.getTime() + 3 * 3600e3);
			return Object.assign({}, a, {
				id: i,
				start: dStart,
				end: dEnd,
				minutes: Math.round((dEnd - dStart) / 60000),
				hasEnd: Boolean(a.to),
				to: a.to || (oNext ? oNext.from : null)
			});
		});
	}

	return {
		EVENT: EVENT,
		AGENDA: AGENDA,
		buildSlots: buildSlots
	};
});
