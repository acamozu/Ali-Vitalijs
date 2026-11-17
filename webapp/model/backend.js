sap.ui.define([
	"sap/ui/model/odata/v2/ODataModel"
], function (ODataModel) {
	"use strict";

	// Where the plan is kept: OData service ZCARPOOL_SRV (tables ZCARPOOL_PLAN + ZCARPOOL_PERSON).
	//   PlanSet('<id>')            Name, Version, Doc (settings, seat plan and rules as JSON), ChangedBy, ChangedAt
	//   PlanSet('<id>')/Persons    one row per person
	// A save is one deep POST on PlanSet (plan + all persons); the server stores it only if `Version` is still the
	// one this browser loaded, otherwise it answers 409 and the user decides (load the new plan or overwrite).
	// If the service cannot be reached at all (local start without SAP), the app works with the browser only.

	function Backend(sServiceUrl, sPlanId, sPlanName) {
		this.planId = sPlanId;
		this.planName = sPlanName;
		this.version = 0;
		this.info = { by: "", at: "" };
		this.model = new ODataModel(sServiceUrl, { useBatch: false, json: true, defaultCountMode: "None", tokenHandling: true });
		this.ready = new Promise(function (resolve) {
			this.model.attachMetadataLoaded(function () { resolve(true); });
			this.model.attachMetadataFailed(function () { resolve(false); });
		}.bind(this));
	}

	// the flag fields are Edm.Boolean or a one-character "X" field, depending on how the service was generated
	Backend.prototype._flagIsBoolean = function () {
		if (this._bBool === undefined) {
			this._bBool = false;
			try {
				var oType = this.model.getMetaModel().getODataEntityType(this.model.getMetaModel().getODataEntitySet("PersonSet").entityType);
				(oType.property || []).forEach(function (p) {
					if (p.name === "Car") {
						this._bBool = p.type === "Edm.Boolean";
					}
				}.bind(this));
			} catch (e) {
				/* keep the default */
			}
		}
		return this._bBool;
	};

	Backend.prototype._flag = function (b) {
		return this._flagIsBoolean() ? !!b : (b ? "X" : "");
	};

	function isTrue(v) {
		return v === true || v === "X" || v === "x";
	}

	// "20261117142530" (UTC time stamp of the SAP system) -> local "14:25"
	function clock(v) {
		var s = String(v === null || v === undefined ? "" : v).replace(/\D/g, "");
		if (s.length < 14 || /^0+$/.test(s)) {
			return "";
		}
		var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)));
		return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
	}

	Backend.prototype._take = function (oPlan) {
		this.version = Number(oPlan.Version) || 0;
		this.info = { by: oPlan.ChangedBy || "", at: clock(oPlan.ChangedAt) };
	};

	Backend.prototype._path = function () {
		return this.model.createKey("/PlanSet", { PlanId: this.planId });
	};

	// -> Promise: { doc } (doc as the app keeps it), or null when the plan does not exist on the server yet
	Backend.prototype.load = function () {
		var that = this;
		return new Promise(function (resolve, reject) {
			that.model.read(that._path(), {
				urlParameters: { "$expand": "Persons" },
				success: function (oPlan) {
					var mRest = {};
					try {
						mRest = JSON.parse(oPlan.Doc || "{}") || {};
					} catch (e) {
						mRest = {};
					}
					var aRows = ((oPlan.Persons && oPlan.Persons.results) || []).slice().sort(function (a, b) { return a.Pos - b.Pos; });
					mRest.persons = aRows.map(function (r) {
						return { id: r.PersonId, name: r.Name, car: isTrue(r.Car), seats: Number(r.Seats) || 5, legs: [isTrue(r.Leg1), isTrue(r.Leg2)], team: r.Team || "", lang: r.Lang || "", note: r.Note || "" };
					});
					that._take(oPlan);
					resolve(mRest.persons.length ? { doc: mRest } : null);
				},
				error: function (oError) {
					if (String(oError && oError.statusCode) === "404") {
						that.version = 0;
						resolve(null);
					} else {
						reject(oError);
					}
				}
			});
		});
	};

	// who saved last (for the conflict question)
	Backend.prototype.head = function () {
		var that = this;
		return new Promise(function (resolve) {
			that.model.read(that._path(), {
				urlParameters: { "$select": "PlanId,Version,ChangedBy,ChangedAt" },
				success: function (oPlan) { resolve({ by: oPlan.ChangedBy || "", at: clock(oPlan.ChangedAt), version: Number(oPlan.Version) || 0 }); },
				error: function () { resolve({ by: "", at: "", version: 0 }); }
			});
		});
	};

	// -> Promise; rejects with { conflict: true } when someone else saved in between, else with { error }
	Backend.prototype.save = function (oDoc, bOverwrite) {
		var that = this;
		var mRest = { restBy: oDoc.restBy, groupBy: oDoc.groupBy, limits: oDoc.limits, edits: oDoc.edits, rules: oDoc.rules };
		var fnSend = function (iVersion) {
			return new Promise(function (resolve, reject) {
				that.model.create("/PlanSet", {
					PlanId: that.planId,
					Name: that.planName,
					Version: iVersion,
					Doc: JSON.stringify(mRest),
					Persons: oDoc.persons.map(function (p, i) {
						return {
							PlanId: that.planId, PersonId: p.id, Pos: i + 1, Name: p.name, Car: that._flag(p.car), Seats: p.seats,
							Leg1: that._flag(p.legs[0]), Leg2: that._flag(p.legs[1]), Team: p.team || "", Lang: p.lang || "", Note: p.note || ""
						};
					})
				}, {
					success: function (oPlan) {
						that._take(oPlan);
						resolve();
					},
					error: function (oError) {
						var sStatus = String(oError && oError.statusCode);
						reject(sStatus === "409" || sStatus === "412" ? { conflict: true } : { error: oError });
					}
				});
			});
		};
		if (bOverwrite) {
			return this.head().then(function (o) { return fnSend(o.version); });
		}
		return fnSend(this.version);
	};

	Backend.prototype.destroy = function () {
		this.model.destroy();
	};

	return Backend;
});
