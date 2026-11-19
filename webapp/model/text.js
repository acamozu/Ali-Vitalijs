sap.ui.define([
	"sap/base/i18n/ResourceBundle"
], function (ResourceBundle) {
	"use strict";

	// The texts of the page in German and English. They live in i18n/i18n_<lang>.properties; this module reads both
	// files and hands them out as TEXT[lang] in the form the page code uses (t.now, t.left(12), t.before("09:00")).
	// The language is switched inside the page (DE / EN buttons), independent of the logon language, which is why
	// both are loaded.

	var LANGS = ["de", "en"];
	var KEYS = ["scan", "openAgenda", "welcome", "now", "next", "min", "openEnd", "after", "agenda", "rights"];
	var FUNCTIONS = ["left", "before"]; // texts with a value: {0}
	var LOCALE = { de: "de-DE", en: "en-GB" };
	var TEXT = {};

	function take(sLang, oBundle) {
		var t = {};
		KEYS.forEach(function (sKey) {
			t[sKey] = oBundle.getText(sKey);
		});
		FUNCTIONS.forEach(function (sKey) {
			t[sKey] = function (v) {
				return oBundle.getText(sKey, [v]);
			};
		});
		// "27. November 2026" / "27 November 2026" for the day of the event ("2026-11-27")
		t.dateLong = function (sDate) {
			var a = String(sDate).split("-");
			var d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12));
			return new Intl.DateTimeFormat(LOCALE[sLang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
		};
		TEXT[sLang] = t;
	}

	return {
		LANGS: LANGS,
		TEXT: TEXT,

		// -> Promise, resolved when both languages are there
		load: function () {
			var sUrl = sap.ui.require.toUrl("com/alseda/agenda/i18n/i18n.properties");
			return Promise.all(LANGS.map(function (sLang) {
				return ResourceBundle.create({ url: sUrl, locale: sLang, async: true }).then(function (oBundle) {
					take(sLang, oBundle);
				});
			}));
		}
	};
});
