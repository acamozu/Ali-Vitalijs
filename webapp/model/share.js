// cards (one per car / group / taxi) and plain-text messages for a leg
sap.ui.define([], function () {
	"use strict";

	function buildCards(layout, byId, t) {
		var names = function (ids) {
			return ids.filter(Boolean).map(function (id) {
				return byId[id].name;
			});
		};
		var cards = [];
		layout.order.cars.forEach(function (id, n) {
			var slots = layout.boxes[id];
			cards.push({ id: id, kind: "car", title: t.car + " " + (n + 1), lead: [t.driver, byId[slots[0]].name], people: names(slots.slice(1)) });
		});
		layout.order.groups.forEach(function (id, n) {
			var m = layout.boxes[id].filter(Boolean);
			if (!m.length) {
				return;
			}
			cards.push({
				id: id,
				kind: "tram",
				title: t.group + " " + (n + 1),
				lead: [t.buyer, byId[layout.buyers[id]].name],
				people: names(m.filter(function (x) {
					return x !== layout.buyers[id];
				}))
			});
		});
		layout.order.taxis.forEach(function (id, n) {
			var m = layout.boxes[id].filter(Boolean);
			if (m.length) {
				cards.push({ id: id, kind: "taxi", title: t.taxi + " " + (n + 1), lead: null, people: names(m) });
			}
		});
		return cards;
	}

	function cardText(c, head, t) {
		return [head, c.title, c.lead ? c.lead[0] + ": " + c.lead[1] : null, (c.kind === "car" ? t.passengers : t.members) + ": " + (c.people.join(", ") || "–")]
			.filter(Boolean)
			.join("\n");
	}

	// resolves true / false; the clipboard API first, the hidden textarea when it is missing or refuses
	function copyText(text) {
		return new Promise(function (resolve) {
			resolve(navigator.clipboard.writeText(text));
		}).then(
			function () {
				return true;
			},
			function () {
				var ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				var ok = false;
				try {
					ok = document.execCommand("copy");
				} catch (e) {
					// keep ok = false
				}
				ta.remove();
				return ok;
			}
		);
	}

	return {
		buildCards: buildCards,
		cardText: cardText,
		copyText: copyText
	};
});
