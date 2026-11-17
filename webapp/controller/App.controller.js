sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("com.alseda.carpool.controller.App", {

		onInit: function () {
			var oComponent = this.getOwnerComponent();
			this.byId("planner").setOptions({
				backend: oComponent.getBackend(),
				logo: sap.ui.require.toUrl("com/alseda/carpool/img/alseda-logo.png"),
				photo: sap.ui.require.toUrl("com/alseda/carpool/img/conference.png"),
				splash: !new URLSearchParams(window.location.search).has("nosplash")
			});
		}
	});
});
