sap.ui.define([
	"sap/ui/core/UIComponent",
	"./model/backend"
], function (UIComponent, Backend) {
	"use strict";

	return UIComponent.extend("com.alseda.carpool.Component", {

		metadata: {
			manifest: "json"
		},

		// the connection to the OData service that keeps the plan; null with ?local (browser only, for tests)
		getBackend: function () {
			if (this._oBackend === undefined) {
				var oQuery = new URLSearchParams(window.location.search);
				var mConfig = this.getManifestEntry("/sap.ui5/config") || {};
				// the OData data source of the manifest, whatever it is called there (Web IDE names it after the service)
				var mSources = this.getManifestEntry("/sap.app/dataSources") || {};
				var mSource = {};
				Object.keys(mSources).forEach(function (sName) {
					if (!mSource.uri && mSources[sName].type === "OData") {
						mSource = mSources[sName];
					}
				});
				this._oBackend = oQuery.has("local") || !mSource.uri
					? null
					: new Backend(mSource.uri, oQuery.get("plan") || mConfig.planId, mConfig.planName);
			}
			return this._oBackend;
		},

		destroy: function () {
			if (this._oBackend) {
				this._oBackend.destroy();
			}
			UIComponent.prototype.destroy.apply(this, arguments);
		}
	});
});
