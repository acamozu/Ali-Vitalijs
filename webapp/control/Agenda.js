sap.ui.define([
	"sap/ui/core/Control",
	"../app/App"
], function (Control, App) {
	"use strict";

	// The page as one control. UI5 only renders the host element; everything inside it is drawn and kept up to
	// date by app/App.js, which is started once the host is in the DOM.
	return Control.extend("com.alseda.agenda.control.Agenda", {

		metadata: {
			properties: {
				// { backend, logo, photo, splash, skin } - see app/App.js
				options: { type: "object", defaultValue: null }
			}
		},

		renderer: function (oRm, oControl) {
			oRm.write("<div");
			oRm.writeControlData(oControl);
			oRm.addClass("agHost");
			oRm.writeClasses();
			oRm.write("></div>");
		},

		onBeforeRendering: function () {
			this._stop();
		},

		onAfterRendering: function () {
			var mOptions = this.getOptions();
			if (mOptions) {
				// the loading screen is shown once, not again when UI5 renders the control a second time
				this._app = new App(this.getDomRef(), Object.assign({}, mOptions, { splash: mOptions.splash !== false && !this._bShown }));
				this._app.start();
				this._bShown = true;
			}
		},

		_stop: function () {
			if (this._app) {
				this._app.destroy();
				this._app = null;
			}
		},

		exit: function () {
			this._stop();
		}
	});
});
