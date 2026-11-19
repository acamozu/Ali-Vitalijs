# agendafiori – Live agenda of the Year-End Conference 2026 as a UI5 / Fiori app

Sibling of the web page (repo `Ali-Vitalijs`, branch `year-end-conference-agenda`). Same page, same functions, built as
a UI5 freestyle app for **SAPUI5 1.71.58** (`sap_fiori_3`). New here: the agenda is kept in the SAP system (OData
service `ZAGENDA_SRV` on A2H) instead of in the source code.

## Run it locally

```
npm install
npm start            # static server on http://localhost:8087
```

Open `http://localhost:8087/index.html` (QR page) or `.../index.html#agenda` (agenda page). Without the SAP service the
app shows the agenda built into `webapp/model/agenda.js` – the same one as in the web version.
`inkwell.html` is the second page of the web version: the same app in the carpool look.

URL parameters, as in the web version: `lang=de|en`, `layout=classic|cards|rings`, `now=10:40` (simulate a time on the
event day), `today` (treat today as the event day), `nosplash`, `url=https://...` (address in the QR code).
Fiori version only: `local` (never call the service), `skin=inkwell`, `event=<EventId>` (another event than the one in
the manifest).

## Structure

| File | What it does |
|---|---|
| `webapp/Component.js` | creates the connection to the service (`model/backend.js`) |
| `webapp/view/App.view.xml`, `control/Agenda.js` | UI5 renders one host element; the page inside it is drawn by `app/` |
| `webapp/app/App.js` | state, clock, language, loading screen, intro animation (dot running down the bar), QR code |
| `webapp/app/render.js` | the markup of the page (same structure and class names as the web version) |
| `webapp/app/morph.js` | updates the DOM in place after a change (running animations and transitions survive) |
| `webapp/model/agenda.js` | built-in agenda (fallback) and the calculation of start / end of every item |
| `webapp/model/clock.js` | German time from the web server, not from the device – 1:1 from the web version |
| `webapp/model/backend.js` | reads event + agenda items through OData |
| `webapp/model/text.js`, `i18n/i18n_de / _en.properties` | the texts of the page in German and English (`i18n.properties` = German fallback) |
| `webapp/model/icons.js` | the icons as SVG strings (lucide) – generated |
| `webapp/lib/qrcodegen.js` | QR code generator (Project Nayuki, MIT) – the one the web version draws its code with |
| `webapp/css/style.css` | the stylesheet of the web version, limited to the app root `.agHost` – generated |
| `webapp/css/host.css` | the few Fiori-only rules (the app scrolls inside its own container) |
| `webapp/css/fonts.css` | Rubik, embedded as base64 – generated |
| `webapp/css/skin.css`, `fonts-skin.css` | carpool look and its fonts, loaded only for `inkwell.html` / `?skin=inkwell` – generated |

`node tools/gen-assets.mjs` writes the generated files from the web version (it must be checked out next to this
folder as `Github_Ali_Vitalijs_year-end-conference-agenda`, with `npm install` done). So a change of the look is made
in the web version and taken over with one command.

## Backend (A2H, client 100, all in `$TMP`)

| Object | What |
|---|---|
| `ZCL_AGENDA_SETUP` | console class (F9 in ADT): creates the two tables, registers model + service, adds and activates the service in the Gateway (alias `LOCAL`). Leaves alone what exists. |
| `ZAGENDA_EVENT` | one row per event: `EVENT_ID`, `TITLE`, `COMPANY`, `EVENT_DATE`, `TZ`, `VENUE`, `CITY`, `ADDRESS`, `PUBLIC_URL`, changed by / at |
| `ZAGENDA_ITEM` | the agenda items: `EVENT_ID`, `POS`, `ICON`, `TIME_FROM`, `TIME_TO`, `ITEM_TYPE`, `SECTION_DE / _EN`, `TITLE_DE / _EN`, `SUBTITLE_DE / _EN`, `SPEAKER`, `LOCATION` |
| `ZCL_AGENDA_MPC` | model, written by hand (no SEGW project): `Event`, `Item`, sets `EventSet`, `ItemSet`, navigation `Items` |
| `ZCL_AGENDA_DPC` | data provider, read only: event(s), items of an event |
| `ZCL_AGENDA_DATA` | console class (F9): writes the agenda of the conference as event `YEC2026` (only if it has no items yet) |

The sources are in `abap/`. Order on a new system: create and run `ZCL_AGENDA_SETUP` (tables) → create
`ZCL_AGENDA_MPC`, `ZCL_AGENDA_DPC`, `ZCL_AGENDA_DATA` → run `ZCL_AGENDA_SETUP` again (service) → run `ZCL_AGENDA_DATA`.

The app reads everything with one request: `GET /sap/opu/odata/sap/ZAGENDA_SRV/EventSet('YEC2026')?$expand=Items`.
To change the agenda, change the rows of `ZAGENDA_ITEM` (SE16); the app shows them at the next start.

- `TIME_TO` empty = the item ends when the next one starts (shown as "Ende offen" on the last one).
- `SECTION_DE / _EN` filled = a new part of the day starts with this item (heading in the `cards` layout).
- `ICON`: `coffee`, `hand`, `chart`, `gauge`, `chat`, `food`, `chip`, `coin`, `star`, `pin`, `bus`.
- In the texts a soft hyphen (U+00AD) marks where a long word may be broken on a phone.
- `PUBLIC_URL` empty = the QR code holds the address of this app; filled = that address.

## Checked against the web version

Screenshots of both versions were compared pixel by pixel: QR page and agenda page, all four layouts, before / during /
after the event, German and English, phone / tablet / desktop, and the carpool look. Result: identical (what is left,
below 0.04 % of the pixels, is the photo: `.jpg` here, `.webp` there). The intro animation and the scroll position it
ends at are the same too. Not checked: the app inside the real Launchpad (it is not deployed yet).

## Notes

- Code is ES5 syntax on purpose (old `@ui5/cli` 1.13 builder, as in the other apps). `npm run build` works.
- Both languages are loaded at once, because the language is switched inside the page (DE / EN), independent of the
  logon language. The choice is kept per browser (localStorage).
- Pages: `#agenda` opens the agenda page when the app runs alone; inside the Launchpad it is `#<Object>-<action>&/agenda`.
  The QR code is built accordingly.
- The fonts are embedded in the CSS because the deployment to the ABAP repository stored `.woff2` files as text and
  broke them (seen with the carpool app). The photo is a `.jpg` instead of the `.webp` of the web version for the same
  caution; `.png` / `.jpg` are known to arrive intact.
- `index.html` / `inkwell.html` are only for the standalone start; inside the Launchpad the Component is loaded.
- Not deployed to the ABAP repository yet (BSP application); the OData service is live.
