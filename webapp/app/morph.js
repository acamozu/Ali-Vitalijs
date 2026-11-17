sap.ui.define([], function () {
	"use strict";

	// Brings an existing DOM tree in line with new markup without rebuilding it: elements that stay keep their
	// identity, so the focus, the caret, running CSS transitions and scroll positions survive a re-render.
	// Children are matched by position, or by their "data-k" key where one is given (lists that grow / shrink).

	function keyOf(oNode) {
		return oNode.nodeType === 1 ? oNode.getAttribute("data-k") : null;
	}

	function same(oOld, oNew) {
		if (oOld.nodeType !== oNew.nodeType) {
			return false;
		}
		if (oOld.nodeType !== 1) {
			return true;
		}
		return oOld.nodeName === oNew.nodeName && keyOf(oOld) === keyOf(oNew);
	}

	function syncAttributes(oOld, oNew) {
		var aOld = oOld.attributes;
		var aNew = oNew.attributes;
		var i, oAttr;
		for (i = aOld.length - 1; i >= 0; i--) {
			oAttr = aOld[i];
			if (!oNew.hasAttribute(oAttr.name)) {
				oOld.removeAttribute(oAttr.name);
			}
		}
		for (i = 0; i < aNew.length; i++) {
			oAttr = aNew[i];
			if (oOld.getAttribute(oAttr.name) !== oAttr.value) {
				oOld.setAttribute(oAttr.name, oAttr.value);
			}
		}
	}

	// the "value" attribute is what the field should show; a field the user is typing in is left alone
	function syncValue(oOld, oNew) {
		if (oOld.nodeName !== "INPUT" || oOld.type === "file") {
			return;
		}
		var sValue = oNew.getAttribute("value") || "";
		if (oOld !== document.activeElement && oOld.value !== sValue) {
			oOld.value = sValue;
		}
	}

	function morphNode(oOld, oNew) {
		if (oOld.nodeType !== 1) {
			if (oOld.nodeValue !== oNew.nodeValue) {
				oOld.nodeValue = oNew.nodeValue;
			}
			return;
		}
		if (oOld.isEqualNode(oNew)) {
			syncValue(oOld, oNew);
			var aFields = oOld.getElementsByTagName("input");
			if (aFields.length) {
				var aNewFields = oNew.getElementsByTagName("input");
				for (var i = 0; i < aFields.length; i++) {
					syncValue(aFields[i], aNewFields[i]);
				}
			}
			return;
		}
		syncAttributes(oOld, oNew);
		syncValue(oOld, oNew);
		morphChildren(oOld, oNew);
	}

	function morphChildren(oParent, oNewParent) {
		var mKeyed = null;
		var oChild;
		for (oChild = oParent.firstChild; oChild; oChild = oChild.nextSibling) {
			var sKey = keyOf(oChild);
			if (sKey !== null) {
				mKeyed = mKeyed || {};
				mKeyed[sKey] = oChild;
			}
		}

		var oOld = oParent.firstChild;
		var oNew = oNewParent.firstChild;
		while (oNew) {
			var oNextNew = oNew.nextSibling;
			var sNewKey = keyOf(oNew);
			var oMatch = null;
			if (oOld && same(oOld, oNew)) {
				oMatch = oOld;
			} else if (sNewKey !== null && mKeyed && mKeyed[sNewKey] && mKeyed[sNewKey].nodeName === oNew.nodeName && mKeyed[sNewKey].parentNode === oParent) {
				// a keyed element that exists further down: move it here
				oMatch = mKeyed[sNewKey];
				oParent.insertBefore(oMatch, oOld);
			}
			if (oMatch) {
				if (sNewKey !== null && mKeyed) {
					delete mKeyed[sNewKey];
				}
				oOld = oMatch.nextSibling;
				morphNode(oMatch, oNew);
			} else {
				// nothing to reuse: the new node goes in before the current old one (which is checked again)
				oParent.insertBefore(oNew, oOld);
			}
			oNew = oNextNew;
		}
		while (oOld) {
			var oNext = oOld.nextSibling;
			oParent.removeChild(oOld);
			oOld = oNext;
		}
	}

	return {
		// make the children of oRoot look like sHtml
		apply: function (oRoot, sHtml) {
			var oTemplate = document.createElement("template");
			oTemplate.innerHTML = sHtml;
			morphChildren(oRoot, oTemplate.content);
		}
	};
});
