sap.ui.define([
	"sap/ui/model/odata/v2/ODataModel"
], function (ODataModel) {
	"use strict";

	// Where the agenda is kept: OData service ZAGENDA_SRV (tables ZAGENDA_EVENT + ZAGENDA_ITEM), read only.
	//   EventSet('<id>')          Title, Company, EventDate, Tz, Venue, City, Address, PublicUrl
	//   EventSet('<id>')/Items    one row per agenda item, in the order of Pos
	// The app reads both with one request: GET EventSet('<id>')?$expand=Items.
	// If the service cannot be reached (local start without SAP), the app shows the agenda built into model/agenda.js.

	function Backend(sServiceUrl, sEventId) {
		this.eventId = sEventId;
		this.model = new ODataModel(sServiceUrl, { useBatch: false, json: true, defaultCountMode: "None", tokenHandling: false });
		this.ready = new Promise(function (resolve) {
			this.model.attachMetadataLoaded(function () { resolve(true); });
			this.model.attachMetadataFailed(function () { resolve(false); });
		}.bind(this));
	}

	// { de, en } of two fields, or undefined when both are empty
	function pair(sDe, sEn) {
		return sDe || sEn ? { de: sDe || sEn, en: sEn || sDe } : undefined;
	}

	// one row of ItemSet -> one entry in the form of model/agenda.js
	function toItem(r) {
		var o = { icon: r.Icon || "star", from: r.TimeFrom, type: r.Type || "session", title: pair(r.TitleDe, r.TitleEn) || { de: "", en: "" } };
		if (r.TimeTo) { o.to = r.TimeTo; }
		if (pair(r.SectionDe, r.SectionEn)) { o.section = pair(r.SectionDe, r.SectionEn); }
		if (pair(r.SubtitleDe, r.SubtitleEn)) { o.subtitle = pair(r.SubtitleDe, r.SubtitleEn); }
		if (r.Speaker) { o.speaker = r.Speaker; }
		if (r.Location) { o.location = r.Location; }
		return o;
	}

	// -> Promise: { event, agenda } as in model/agenda.js, or null when the service has no (complete) agenda
	Backend.prototype.load = function () {
		var that = this;
		return this.ready.then(function (bOk) {
			if (!bOk) {
				return null;
			}
			return new Promise(function (resolve) {
				that.model.read(that.model.createKey("/EventSet", { EventId: that.eventId }), {
					urlParameters: { "$expand": "Items" },
					success: function (e) {
						var aRows = ((e.Items && e.Items.results) || []).slice().sort(function (a, b) { return a.Pos - b.Pos; });
						var aAgenda = aRows.filter(function (r) { return /^\d\d:\d\d$/.test(r.TimeFrom || ""); }).map(toItem);
						if (!aAgenda.length || !/^\d{4}-\d\d-\d\d$/.test(e.EventDate || "")) {
							resolve(null);
							return;
						}
						resolve({
							event: {
								title: e.Title, company: e.Company, date: e.EventDate, tz: e.Tz || "+01:00",
								venue: e.Venue, city: e.City, address: e.Address, publicUrl: e.PublicUrl || ""
							},
							agenda: aAgenda
						});
					},
					error: function () {
						resolve(null);
					}
				});
			});
		});
	};

	Backend.prototype.destroy = function () {
		this.model.destroy();
	};

	return Backend;
});
