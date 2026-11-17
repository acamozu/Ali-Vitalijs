# carpoolfiori_ – Transfer planner (carpool) of the Year-End Conference 2026 as a UI5 / Fiori app

Sibling of the web page (repo `Ali-Vitalijs`, branch `year-end-carpool`, `src/carpool/`). Same page, same functions,
built as a UI5 freestyle app for **SAPUI5 1.71.58** (`sap_fiori_3`). New here: the plan is kept in the SAP system
(OData service `ZCARPOOL_SRV` on A2H) instead of only in the browser.

## Run it locally

```
npm install
npm start            # static server on http://localhost:8086
```

Open `http://localhost:8086/index.html`. Without the SAP service the app notices that and keeps the plan in the browser
("Nur in diesem Browser" in the Planung bar). URL parameters: `nosplash` (skip the loading screen), `local` (never call
the service), `lang=de|en|ru`, `plan=<PlanId>` (another plan than the one in the manifest).

## Structure

| File | What it does |
|---|---|
| `webapp/Component.js` | creates the connection to the service (`model/backend.js`) |
| `webapp/view/App.view.xml`, `control/Planner.js` | UI5 renders one host element; the page inside it is drawn by `app/` |
| `webapp/app/App.js` | state, undo / redo, every action of the page, mouse drag, dropdown list, autosave |
| `webapp/app/render.js` | the markup of the page (same structure and class names as the web version) |
| `webapp/app/morph.js` | updates the DOM in place after a change (focus, caret and transitions survive) |
| `webapp/model/planner.js`, `checks.js`, `share.js`, `tags.js`, `state.js` | planning logic, 1:1 from the web version |
| `webapp/i18n/i18n_de / _en / _ru.properties` | all texts of the page in German, English, Russian (`i18n.properties` = German fallback); generated from the web version by `tools/gen-i18n.mjs` |
| `webapp/model/text.js` | reads the three i18n files and hands the texts to the page (`t.carsH`, `t.tickets(n)` ...); also generated |
| `webapp/model/excel.js`, `excelImport.js`, `lib/exceljs.min.js` | Excel export / import (ExcelJS 4.4.0, loaded on first use) |
| `webapp/model/icons.js` | the icons as SVG strings (lucide), car drawing, splash skyline |
| `webapp/model/backend.js` | load / save through OData, version check, fallback to the browser |
| `webapp/css/style.css` | the look of the web version, scoped to the app; `host.css` = the few Fiori-only rules; `fonts.css` = Rubik, embedded as base64 (source files in `fonts/`, not needed on the server) |

## Backend (A2H, client 100, all in `$TMP`)

| Object | What |
|---|---|
| `ZCARPOOL_SETUP` (report) | creates the two tables, run once with F8 |
| `ZCARPOOL_PLAN` | one row per plan: `PLAN_ID`, `NAME`, `VERSION`, `DOC` (settings, seat plan, rules as JSON), created / changed by / at |
| `ZCARPOOL_PERSON` | the people of a plan: `PLAN_ID`, `PERSON_ID`, `POS`, `NAME`, `CAR`, `SEATS`, `LEG1`, `LEG2`, `TEAM`, `LANG`, `NOTE` |
| `ZCL_CARPOOL_MPC` | model, written by hand (no SEGW project): `Plan`, `Person`, sets `PlanSet`, `PersonSet`, navigation `Persons`; source in `abap/` of this branch |
| `ZCL_CARPOOL_DPC` | data provider: read, deep save with version check, delete; source in `abap/` |
| `ZCARPOOL_REGISTER` (report) | registers model `ZCARPOOL_MDL` and service `ZCARPOOL_SRV` in the backend, run once with F8; then /IWFND/MAINT_SERVICE -> Add Service |

Save = one deep `POST PlanSet` (plan + all persons). The server stores it only if `Version` is the stored one,
otherwise HTTP 409 and the app asks: load the new plan or overwrite. Load = `GET PlanSet('<id>')?$expand=Persons`.

## Tests

```
npm test             # logic, texts and Excel against the original modules of the web version (node)
node e2e/e2e.mjs     # the browser test of the web version, pointed at this app (needs npm start + Chrome)
```

Both need the web version checked out next to this repo (`../../../Ali-Vitalijs-event-agenda`), because they compare
against its modules and reuse its packages.

## Notes

- Code is ES5 syntax on purpose (old `@ui5/cli` 1.13 builder, as in the other apps).
- All three languages are loaded at once, because the language is switched inside the page (DE / EN / RU), independent of the logon language. To change a text: edit `tools/gen-i18n.mjs` (Fiori-only texts) or the web version, run `node tools/gen-i18n.mjs`, then `npm test`.
- Section order / variants and the language stay per browser (localStorage), as in the web version.
- `index.html` is only for the standalone start; inside the Launchpad the Component is loaded.
