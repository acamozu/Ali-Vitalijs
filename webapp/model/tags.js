// colours for teams / languages
sap.ui.define([], function () {
	"use strict";

	var PALETTE = ["#6E92F2", "#F0846F", "#4FBF86", "#E3B13B", "#A67BEF", "#42BFD0", "#EE7DB8", "#8C99A8"];
	var NO_TAG = "#C9CDD3";

	// stable colour per value: by position in the sorted list of values in use
	function tagColors(persons, by) {
		var values = Array.from(new Set(persons.map(function (p) {
			return by === "team" ? p.team : by === "lang" ? p.lang : "";
		}).filter(Boolean))).sort(function (a, b) {
			return a.localeCompare(b);
		});
		var map = Object.fromEntries(values.map(function (v, i) {
			return [v, PALETTE[i % PALETTE.length]];
		}));
		return {
			values: values,
			color: function (v) {
				return (v && map[v]) || NO_TAG;
			}
		};
	}

	return {
		NO_TAG: NO_TAG,
		tagColors: tagColors
	};
});
