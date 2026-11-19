sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("com.alseda.agenda.controller.App", {

		onInit: function () {
			var oComponent = this.getOwnerComponent();
			var oQuery = new URLSearchParams(window.location.search);
			this.byId("agenda").setOptions({
				backend: oComponent.getBackend(),
				logo: sap.ui.require.toUrl("com/alseda/agenda/img/alseda-logo.png"),
				photo: sap.ui.require.toUrl("com/alseda/agenda/img/photo.jpg"),
				splash: !oQuery.has("nosplash"),
				// inkwell.html asks for the carpool look through the component data; ?skin=inkwell does the same
				skin: (oComponent.getComponentData() || {}).skin || ""
			});
		}
	});
});
