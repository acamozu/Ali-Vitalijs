import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ListChecks, CarTaxiFront, Users, MessageSquareText, Menu, ListPlus, ArrowRight, Trash2, Pencil, LayoutList, ArrowUp, ArrowDown, GripVertical, Car, Train, Ticket, Check, Download, Upload, Plus, Minus, X, RotateCcw, Undo2, Redo2, Copy, Save, FolderOpen, TriangleAlert, Info, CircleCheck } from "lucide-react";
import { tagColors, NO_TAG } from "./tags.js";
import LangSelect from "./LangSelect.jsx";
import { computeChecks, newRule, cleanRules, ruleReady, RULE_TYPES } from "./checks.js";
import { buildCards, cardText, copyText } from "./share.js";
import { EVENT } from "../agenda.js";
import photo from "../assets/photo-1.webp";
import logo from "../assets/alseda-logo.png";
import { WebIcon, LinkedInIcon } from "../SocialIcons.jsx";
import {
  LEGS,
  CAR_SEATS,
  MIN_SEATS,
  DEFAULT_LIMITS,
  LIMIT_RANGE,
  TAXI_RANGE,
  defaultPersons,
  newPerson,
  nextName,
  tagOf,
  LANG_OPTIONS,
  normLang,
  planLeg,
  baseLayout,
  reconcileLayout,
  applyCounts,
  fixBuyers,
  newBoxId,
  copyLayoutToLeg,
  parseRoster,
} from "./planner.js";

const STORE = "carpool-v3";

const TEXT = {
  de: {
    title: "Transfers der Year-End Conference",
    sub: "Vom Hotel zum Polizeipräsidium und weiter zum Abendessen – Autos, Tram und Taxi automatisch geplant.",
    demo: "Fiktive Testnamen – die echte Liste per CSV laden.",
    leg: "Etappe",
    date: "Datum",
    depart: "Abfahrt",
    oclock: "Uhr",
    navCars: "Autos",
    navTram: "ÖPNV",
    navTaxi: "Taxi",
    navAll: "Personen",
    navChecks: "Hinweise",
    navCards: "Karten",
    menu: "Menü",
    plannerMenu: "Planer-Menü",
    goTo: "Springe zu",
    persons: "Personen",
    away: "nicht dabei",
    byCar: "im Auto",
    byTram: "mit der Tram",
    byTaxi: "im Taxi",
    restBy: "Alle ohne Auto fahren mit",
    export: "Plan exportieren",
    carsH: "Fahrgemeinschaften",
    carsSub: "Wer ein Auto mitbringt, fährt selbst. Die Mitfahrer werden gleichmäßig verteilt.",
    dragHint: "Fahrgast antippen, dann Zielsitz antippen. Fahrer bleiben im Auto.",
    picked: "ausgewählt – Zielsitz antippen",
    cancel: "Abbrechen",
    car: "Auto",
    driver: "Fahrer:in",
    free: "frei",
    noCars: "Niemand bringt ein Auto mit.",
    tramH: "ÖPNV",
    tramSub: (from) => `Ab ${from}. Eine Person pro Gruppe kauft das Gruppenticket – Ticket-Symbol antippen, um sie zu wechseln.`,
    moveHint: "Person antippen, dann Zielplatz antippen – oder mit der Maus ziehen.",
    group: "Gruppe",
    buyer: "Gruppenticket",
    makeBuyer: "Kauft das Ticket",
    tickets: (n) => `${n} Gruppentickets`,
    groupSize: "Max. pro Gruppe",
    groupCount: "Gruppen",
    taxiSize: "Plätze pro Taxi",
    addGroup: "Gruppe",
    addTaxi: "Taxi",
    removeBox: "Leere Gruppe entfernen",
    taxiH: "Taxi",
    taxiSub: "Kleine Reste (1–2 Personen) bekommen bei Tram ein Taxi. Personen lassen sich frei verschieben.",
    taxi: "Taxi",
    nothing: "Keine Gruppe nötig.",
    allH: "Personen",
    allSub: "Name, Auto und Teilnahme je Etappe. Änderungen planen sofort neu.",
    csvHint: "CSV: Name; Auto (ja/nein); Plätze; Etappe 1; Etappe 2; Team; Sprache. Nur der Name ist Pflicht.",
    count: "Anzahl",
    addPh: "Name hinzufügen",
    add: "Hinzufügen",
    load: "CSV laden",
    reset: "Testdaten",
    resetAsk: "Alle Änderungen verwerfen und die Testdaten laden?",
    replaceAsk: (n) => `${n} Personen aus der Datei laden und die aktuelle Liste ersetzen?`,
    csvEmpty: "In der Datei wurden keine Namen gefunden.",
    remove: "Entfernen",
    seatsOf: "Plätze",
    mode: "Auto",
    assign: "Zuordnung",
    name: "Name",
    filterAll: "Alle",
    filterAway: "Nicht dabei",
    ruleH: "So wird verteilt",
    ruleSub: "Vier einfache Regeln.",
    rules: [
      "Wer ein Auto mitbringt, fährt selbst und nimmt Mitfahrer:innen mit, bis alle Plätze belegt sind (Fahrer eingerechnet).",
      "Mitfahrer werden gleichmäßig auf die Autos verteilt.",
      "Alle übrigen fahren in Gruppen mit der Tram (ein Gruppenticket pro Gruppe, Größe einstellbar) oder im Taxi. Ein Rest unter 3 Personen nimmt ein Taxi.",
      "Alles lässt sich von Hand ändern: Personen verschieben, Ticketkäufer wechseln, Gruppen und Taxis hinzufügen. Änderungen bleiben gespeichert.",
    ],
    darkH: (n) => `${n} Personen unterwegs`,
    rights: "Alle Rechte vorbehalten.",
    csvHead: ["Etappe", "Zeit", "Von", "Nach", "Name", "Transport", "Gruppe", "Rolle", "Team", "Sprache"],
    xl: {
      title: "Transfer-Plan Year-End Conference",
      overview: "Übersicht",
      people: "Personen",
      level: "Stufe",
      check: "Anwesenheit",
      checkCol: "Anwesend",
      messages: "Nachrichten",
      costs: "Kosten",
      ticketPrice: "Preis Gruppenticket (Beispielwert)",
      taxiPrice: "Preis pro Taxifahrt (Beispielwert)",
      adjust: "Beispielwerte – die gelben Felder anpassen, die Summen rechnen sich neu.",
      tickets: "Gruppentickets",
      rides: "Taxifahrten",
      ticketCost: "Kosten Tickets",
      taxiCost: "Kosten Taxi",
      total: "Gesamt",
      sum: "Summe",
    },
    notThere: "nicht dabei",
    optionsLabel: "Planung",
    groupBy: "Zusammen reisen nach",
    groupNone: "Ohne",
    groupTeam: "Team",
    groupLang: "Sprache",
    team: "Team",
    langCol: "Sprache",
    undo: "Rückgängig",
    redo: "Wiederholen",
    savePlan: "Plan speichern",
    loadPlan: "Plan laden",
    planSaved: "Plan gespeichert",
    planBad: "Das ist keine gültige Plan-Datei.",
    planAsk: "Den gespeicherten Plan laden und die aktuelle Planung ersetzen?",
    planHint: "Die Plan-Datei enthält Namen – vertraulich behandeln. Laden: .json oder die exportierte Excel-Datei.",
    checksH: "Hinweise",
    checksSub: "Der Plan prüft sich selbst.",
    noIssues: "Alles in Ordnung – keine Hinweise.",
    rulesH: "Eigene Regeln",
    rulesSub: "Zusätzliche Bedingungen, die der Plan prüft. Sie werden mit dem Plan gespeichert.",
    addRule: "+ Regel",
    rulesBtn: "Regeln",
    departAt: "Abfahrt",
    exportFailed: "Der Export ist fehlgeschlagen.",
    noRules: "Noch keine eigenen Regeln.",
    ruleTypes: { pair: "Zwei Personen", lang: "Sprache pro Fahrzeug", teamMax: "Team-Grenze", person: "Personenregel", note: "Notiz-Regel" },
    pairWith: "und",
    pairTogether: "fahren zusammen",
    pairApart: "fahren getrennt",
    ruleLangA: "Jedes Fahrzeug braucht mindestens eine Person mit",
    ruleTeamA: "Höchstens",
    ruleTeamB: "Person(en) pro Fahrzeug aus",
    allTeams: "jedem Team",
    personNoTaxi: "nimmt kein Taxi",
    personNoTram: "fährt nicht mit der Tram",
    personInCar: "fährt im Auto",
    personNotAlone: "fährt nicht allein",
    noteCol: "Notiz",
    keyword: "Stichwort",
    noteRuleA: "Personen, deren Notiz enthält",
    copyLeg2: "Etappe 2 = Etappe 1",
    copyLegTip: "Etappe 2 aus Etappe 1 übernehmen (mit Rückgängig umkehrbar)",
    legCopied: "Etappe 2 aus Etappe 1 übernommen",
    pickPerson: "Person",
    levelWarn: "Warnung",
    levelInfo: "Hinweis",
    levelToggle: "Warnung oder Hinweis",
    ruleOn: "Regel aktiv",
    ruleActive: "Aktiv",
    ruleInactive: "Inaktiv",
    ruleRemove: "Regel löschen",
    legWord: "Etappe",
    kinds: { car: "Auto", group: "Gruppe", taxi: "Taxi", team: "Team", lang: "Sprache" },
    chk: {
      noPeople: () => "Niemand ist bei dieser Etappe dabei.",
      rule: (a) =>
        ({
          pair: a.mode === "together" ? `${a.a} und ${a.b} sollen zusammen fahren, sitzen aber getrennt.` : `${a.a} und ${a.b} sollen getrennt fahren, sitzen aber im selben Fahrzeug.`,
          lang: `${a.bad} von ${a.total} Fahrzeugen und Gruppen haben niemanden mit ${a.lang}.`,
          teamMax: `${a.bad} Fahrzeuge oder Gruppen haben mehr als ${a.max} ${a.max === 1 ? "Person" : "Personen"} ${a.team === "*" ? "desselben Teams" : `aus Team ${a.team}`}.`,
          note: `Notiz „${a.keyword}“ (${a.names}): ${{"noTaxi":"sollen kein Taxi nehmen","noTram":"sollen nicht mit der Tram fahren","inCar":"sollen im Auto fahren","notAlone":"sollen nicht allein fahren"}[a.rule]}.`,
          person: { noTaxi: `${a.name} soll kein Taxi nehmen.`, noTram: `${a.name} soll nicht mit der Tram fahren.`, inCar: `${a.name} soll im Auto fahren.`, notAlone: `${a.name} fährt allein im Fahrzeug.` }[a.rule],
        })[a.type],
      emptyCar: ({ n }) => `Auto ${n} fährt nur mit Fahrer:in, während andere Tram oder Taxi nehmen.`,
      freeSeats: ({ free, others }) => `${free} freie Autoplätze, obwohl ${others} Personen mit Tram oder Taxi fahren.`,
      smallGroup: ({ n, size }) => `Gruppe ${n} hat nur ${size} ${size === 1 ? "Person" : "Personen"} – ein Taxi ist evtl. günstiger.`,
      lonelyTaxi: ({ n }) => `Taxi ${n} fährt mit nur einer Person, andere Taxis haben noch Platz.`,
      emptyBox: ({ kind, n }) => `${kind === "group" ? "Gruppe" : "Taxi"} ${n} ist leer.`,
      mixed: ({ count, total, by }, k) => `${count} von ${total} Autos, Gruppen und Taxis sind nicht einheitlich (${k[by]}).`,
      carNotThere: ({ name }) => `${name} bringt das Auto, ist aber bei Etappe 1 nicht dabei – das Auto steht dann nicht am Startort.`,
    },
    cardsH: "Karten & Nachrichten",
    cardsSub: "Pro Auto, Gruppe und Taxi eine Karte – zum Kopieren.",
    copy: "Kopieren",
    copied: "Kopiert",
    copyLeg: "Etappe kopieren",
    passengers: "Mitfahrer:innen",
    members: "Mit",
    all: "Alle",
    layout: "Layout",
    layoutH: "Anordnung",
    layoutHint: "Kopfbereich und die letzten drei Blöcke bleiben fest. Alles dazwischen lässt sich verschieben.",
    variants: "Varianten",
    defaultVariant: "Standard",
    editOrder: "Reihenfolge ändern",
    saveNewVariant: "Als neue Variante speichern",
    updateVariant: "Variante aktualisieren",
    deleteVariant: "Variante löschen",
    resetLayout: "Standard wiederherstellen",
    variantName: "Name der Variante",
    variant: "Variante",
    variantSaved: "Variante gespeichert",
    variantDeleteAsk: (n) => `Variante „${n}“ löschen?`,
    changed: "geändert",
    undoOrder: "Rückgängig",
    rename: "Umbenennen",
    save: "Speichern",
    newVariant: "Neue Variante",
    done: "Fertig",
    close: "Schließen",
    up: "Nach oben",
    down: "Nach unten",
    sections: { leg: "Etappe & Transport", plan: "Planung", counts: "Verteilung", checks: "Hinweise", cars: "Autos", tram: "Tram", taxi: "Taxi", people: "Personen", cards: "Karten & Nachrichten" },
  },
  en: {
    title: "Year-End Conference transfers",
    sub: "From the hotel to the Old Police Headquarters and on to dinner – cars, tram and taxi planned automatically.",
    demo: "Fictional test names – load the real list from a CSV.",
    leg: "Leg",
    date: "Date",
    depart: "Departure",
    oclock: "",
    navCars: "Cars",
    navTram: "Transit",
    navTaxi: "Taxi",
    navAll: "People",
    navChecks: "Checks",
    navCards: "Cards",
    menu: "Menu",
    plannerMenu: "Planner Menu",
    goTo: "Jump to",
    persons: "People",
    away: "not joining",
    byCar: "by car",
    byTram: "by tram",
    byTaxi: "by taxi",
    restBy: "Everyone without a car takes the",
    export: "Export plan",
    carsH: "Carpools",
    carsSub: "Whoever brings a car drives. Passengers are spread evenly.",
    dragHint: "Tap a passenger, then tap a target seat. Drivers stay put.",
    picked: "selected – tap a target seat",
    cancel: "Cancel",
    car: "Car",
    driver: "Driver",
    free: "free",
    noCars: "Nobody brings a car.",
    tramH: "Public Transport",
    tramSub: (from) => `From ${from}. One person per group buys the group ticket – tap the ticket icon to change who.`,
    moveHint: "Tap a person, then tap a target place – or drag with the mouse.",
    group: "Group",
    buyer: "Group ticket",
    makeBuyer: "Buys the ticket",
    tickets: (n) => `${n} group ${n === 1 ? "ticket" : "tickets"}`,
    groupSize: "Max. per group",
    groupCount: "Groups",
    taxiSize: "Seats per taxi",
    addGroup: "Group",
    addTaxi: "Taxi",
    removeBox: "Remove empty group",
    taxiH: "Taxi",
    taxiSub: "With tram, small leftovers (1–2 people) get a taxi. People can be moved freely.",
    taxi: "Taxi",
    nothing: "No group needed.",
    allH: "People",
    allSub: "Name, car and attendance per leg. Changes re-plan right away.",
    csvHint: "CSV: Name; car (yes/no); seats; leg 1; leg 2; team; language. Only the name is required.",
    count: "Count",
    addPh: "Add a name",
    add: "Add",
    load: "Load CSV",
    reset: "Test data",
    resetAsk: "Discard all changes and load the test data?",
    replaceAsk: (n) => `Load ${n} people from the file and replace the current list?`,
    csvEmpty: "No names were found in the file.",
    remove: "Remove",
    seatsOf: "Seats",
    mode: "Car",
    assign: "Assignment",
    name: "Name",
    filterAll: "All",
    filterAway: "Not joining",
    ruleH: "How people are assigned",
    ruleSub: "Four simple rules.",
    rules: [
      "Whoever brings a car drives and takes passengers until all seats are taken (driver included).",
      "Passengers are spread evenly over the cars.",
      "Everyone else goes in tram groups (one group ticket per group, size adjustable) or by taxi. A rest of fewer than 3 people takes a taxi.",
      "Everything can be changed by hand: move people, change the ticket buyer, add groups and taxis. Changes are kept.",
    ],
    darkH: (n) => `${n} people on the move`,
    rights: "All rights reserved.",
    csvHead: ["Leg", "Time", "From", "To", "Name", "Transport", "Group", "Role", "Team", "Language"],
    xl: {
      title: "Transfer plan Year-End Conference",
      overview: "Overview",
      people: "People",
      level: "Level",
      check: "Check-in",
      checkCol: "Present",
      messages: "Messages",
      costs: "Costs",
      ticketPrice: "Group ticket price (example value)",
      taxiPrice: "Price per taxi ride (example value)",
      adjust: "Example values – adjust the yellow cells, the sums recalculate.",
      tickets: "Group tickets",
      rides: "Taxi rides",
      ticketCost: "Ticket costs",
      taxiCost: "Taxi costs",
      total: "Total",
      sum: "Sum",
    },
    notThere: "not joining",
    optionsLabel: "Planning",
    groupBy: "Keep together by",
    groupNone: "None",
    groupTeam: "Team",
    groupLang: "Language",
    team: "Team",
    langCol: "Language",
    undo: "Undo",
    redo: "Redo",
    savePlan: "Save plan",
    loadPlan: "Load plan",
    planSaved: "Plan saved",
    planBad: "This is not a valid plan file.",
    planAsk: "Load the saved plan and replace the current planning?",
    planHint: "The plan file contains names – handle it confidentially. Load: .json or the exported Excel file.",
    checksH: "Checks",
    checksSub: "The plan checks itself.",
    noIssues: "All good – nothing to flag.",
    rulesH: "Your own rules",
    rulesSub: "Extra conditions the plan checks. They are saved with the plan.",
    addRule: "+ Rule",
    rulesBtn: "Rules",
    departAt: "Departure",
    exportFailed: "The export failed.",
    noRules: "No own rules yet.",
    ruleTypes: { pair: "Two people", lang: "Language per vehicle", teamMax: "Team limit", person: "Person rule", note: "Note rule" },
    pairWith: "and",
    pairTogether: "travel together",
    pairApart: "travel apart",
    ruleLangA: "Every vehicle needs at least one person with",
    ruleTeamA: "At most",
    ruleTeamB: "person(s) per vehicle from",
    allTeams: "any team",
    personNoTaxi: "does not take a taxi",
    personNoTram: "does not take the tram",
    personInCar: "travels by car",
    personNotAlone: "does not travel alone",
    noteCol: "Note",
    keyword: "Keyword",
    noteRuleA: "People whose note contains",
    copyLeg2: "Leg 2 = Leg 1",
    copyLegTip: "Start leg 2 from leg 1 (can be undone)",
    legCopied: "Leg 2 taken over from leg 1",
    pickPerson: "Person",
    levelWarn: "Warning",
    levelInfo: "Info",
    levelToggle: "Warning or info",
    ruleOn: "Rule active",
    ruleActive: "Active",
    ruleInactive: "Inactive",
    ruleRemove: "Delete rule",
    legWord: "Leg",
    kinds: { car: "Car", group: "Group", taxi: "Taxi", team: "team", lang: "language" },
    chk: {
      noPeople: () => "Nobody is joining this leg.",
      rule: (a) =>
        ({
          pair: a.mode === "together" ? `${a.a} and ${a.b} should travel together but are apart.` : `${a.a} and ${a.b} should travel apart but share a vehicle.`,
          lang: `${a.bad} of ${a.total} cars and groups have nobody with ${a.lang}.`,
          teamMax: `${a.bad} cars or groups have more than ${a.max} ${a.max === 1 ? "person" : "people"} ${a.team === "*" ? "of the same team" : `from team ${a.team}`}.`,
          note: `Note “${a.keyword}” (${a.names}): ${{"noTaxi":"should not take a taxi","noTram":"should not take the tram","inCar":"should travel by car","notAlone":"should not travel alone"}[a.rule]}.`,
          person: { noTaxi: `${a.name} should not take a taxi.`, noTram: `${a.name} should not take the tram.`, inCar: `${a.name} should travel by car.`, notAlone: `${a.name} travels alone in a vehicle.` }[a.rule],
        })[a.type],
      emptyCar: ({ n }) => `Car ${n} carries only its driver while others take tram or taxi.`,
      freeSeats: ({ free, others }) => `${free} free car seats while ${others} people go by tram or taxi.`,
      smallGroup: ({ n, size }) => `Group ${n} has only ${size} ${size === 1 ? "person" : "people"} – a taxi may be cheaper.`,
      lonelyTaxi: ({ n }) => `Taxi ${n} carries just one person while other taxis have room.`,
      emptyBox: ({ kind, n }) => `${kind === "group" ? "Group" : "Taxi"} ${n} is empty.`,
      mixed: ({ count, total, by }, k) => `${count} of ${total} cars, groups and taxis are not uniform (${k[by]}).`,
      carNotThere: ({ name }) => `${name} brings the car but is not on leg 1 – the car will not be at the start.`,
    },
    cardsH: "Cards & messages",
    cardsSub: "One card per car, group and taxi – to copy.",
    copy: "Copy",
    copied: "Copied",
    copyLeg: "Copy leg",
    passengers: "Passengers",
    members: "With",
    all: "All",
    layout: "Layout",
    layoutH: "Arrangement",
    layoutHint: "The header area and the last three blocks stay fixed. Everything in between can be moved.",
    variants: "Variants",
    defaultVariant: "Default",
    editOrder: "Change order",
    saveNewVariant: "Save as new variant",
    updateVariant: "Update variant",
    deleteVariant: "Delete variant",
    resetLayout: "Restore default",
    variantName: "Name of the variant",
    variant: "Variant",
    variantSaved: "Variant saved",
    variantDeleteAsk: (n) => `Delete variant “${n}”?`,
    changed: "changed",
    undoOrder: "Undo",
    rename: "Rename",
    save: "Save",
    newVariant: "New variant",
    done: "Done",
    close: "Close",
    up: "Move up",
    down: "Move down",
    sections: { leg: "Leg & transport", plan: "Planning", counts: "Distribution", checks: "Checks", cars: "Cars", tram: "Tram", taxi: "Taxi", people: "People", cards: "Cards & messages" },
  },
};

const RULE_GRADS = ["var(--grad-peach)", "var(--grad-lilac)", "var(--grad-blue)", "var(--grad-green)"];

function useLang() {
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "de" || q === "en") return q;
    try {
      const s = localStorage.getItem("carpool-lang");
      if (s === "de" || s === "en") return s;
    } catch {}
    return "de";
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("carpool-lang", lang);
    } catch {}
  }, [lang]);
  return [lang, setLang];
}

// roster, chosen leg, rest mode and manual seat edits stay in this browser
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.persons) && s.persons.every((p) => p && p.id && p.name && Array.isArray(p.legs))) return s;
  } catch {}
  return null;
}

// tiles are shown right away (no scroll animation)
function Reveal({ as: Tag = "section", className = "", children, ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  );
}

// seat map: front row = driver + front passenger, then rows of up to 3. Two seats in a row sit left/right of the aisle.
// every entry keeps its seat index so a seat can be addressed while dragging.
function seatRows(slots) {
  const list = slots.map((p, i) => ({ p, i }));
  const rows = [list.slice(0, 2)];
  for (let i = 2; i < list.length; i += 3) rows.push(list.slice(i, i + 3));
  return rows.filter((r) => r.length);
}

// two ways to move passengers (drivers never move, their seat is not a target):
//  - tap a passenger, then tap a target seat (works everywhere, the way to go on a phone: the page can be scrolled in between)
//  - mouse: drag the passenger onto a seat
function useSeatDrag(onSwap) {
  const [drag, setDrag] = useState(null); // { car, idx, person, x, y, over }
  const st = useRef({ active: false });
  const swapRef = useRef(onSwap);
  swapRef.current = onSwap;

  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-seat]");
    if (!el) return null;
    const [car, idx] = el.dataset.seat.split(":");
    return { car, idx: Number(idx) };
  };

  const start = (e, from, person) => {
    if (e.pointerType === "touch" || (e.pointerType === "mouse" && e.button !== 0)) return; // touch uses tap-to-select
    const s = st.current;
    s.active = false;
    s.sx = e.clientX;
    s.sy = e.clientY;

    const cleanup = () => {
      s.active = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cleanup);
      setDrag(null);
    };
    const move = (ev) => {
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) <= 5) return;
        s.active = true;
        setDrag({ car: from.car, idx: from.idx, person, x: ev.clientX, y: ev.clientY, over: null });
        return;
      }
      const over = targetAt(ev.clientX, ev.clientY);
      setDrag((d) => d && { ...d, x: ev.clientX, y: ev.clientY, over });
    };
    const up = (ev) => {
      const over = s.active ? targetAt(ev.clientX, ev.clientY) : null;
      cleanup();
      if (over && !(String(over.car) === String(from.car) && over.idx === from.idx)) swapRef.current(from, over);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cleanup);
  };

  return { drag, start };
}

// team / language colour of a person (only while a grouping is chosen)
const TagCtx = createContext({ by: "none", of: () => "", color: () => NO_TAG, title: () => "" });
// the language of a person (DE / EN / RU) written top right of the seat, no colour dots
function TagDot({ p, className = "lang-tag" }) {
  const tg = useContext(TagCtx);
  if (!p.lang) return null;
  return (
    <span className={className} title={tg.title(p)}>
      {p.lang}
    </span>
  );
}

// a small "i" for people with a note (Rollstuhl, Gepäck, ...): the note shows on hover
function NoteFlag({ note, inline }) {
  return (
    <span className={`note-flag${inline ? " inline" : ""}`} title={note} aria-label={note}>
      <Info size="100%" aria-hidden />
    </span>
  );
}

function Seat({ p, idx, carId, dnd, pick, t }) {
  const key = `${carId}:${idx}`;
  const d = dnd.drag;
  const dragging = d && String(d.car) === String(carId) && d.idx === idx;
  const over = d && d.over && String(d.over.car) === String(carId) && d.over.idx === idx && !dragging;
  const picked = pick.picked && String(pick.picked.car) === String(carId) && pick.picked.idx === idx;
  const fx = `${dragging ? " is-dragging" : ""}${over ? " is-over" : ""}${picked ? " is-picked" : ""}`;
  const tap = {
    "data-seat": key,
    role: "button",
    tabIndex: 0,
    "aria-pressed": !!picked,
    onClick: () => pick.onTap({ car: carId, idx }, !!p),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick.onTap({ car: carId, idx }, !!p);
      }
    },
  };

  if (!p) {
    return (
      <div className={`seat empty${fx}`} {...tap}>
        <span className="seat-name">{t.free}</span>
      </div>
    );
  }
  const driver = idx === 0;
  return (
    <div
      className={`seat ${driver ? "driver" : "rider"}${fx}`}
      {...(driver
        ? {}
        : {
            ...tap,
            onPointerDown: (e) => dnd.start(e, { car: carId, idx }, p),
            onContextMenu: (e) => e.preventDefault(),
          })}
    >
      <TagDot p={p} />
      {p.note ? <NoteFlag note={p.note} /> : null}
      {driver ? <span className="seat-role">{t.driver}</span> : null}
      <span className="seat-name">
        {p.name.split(" ").map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </span>
    </div>
  );
}

function CarMap({ carId, slots, dnd, pick, t }) {
  return (
    <div className="car-map" role="group" aria-label={`${t.car} ${carId}`}>
      <svg className="car-art" viewBox="0 0 300 560" aria-hidden="true">
        {/* tyres (under the body) */}
        <g className="tire">
          <rect x="8" y="64" width="22" height="64" rx="8" />
          <rect x="270" y="64" width="22" height="64" rx="8" />
          <rect x="8" y="388" width="22" height="64" rx="8" />
          <rect x="270" y="388" width="22" height="64" rx="8" />
        </g>
        {/* body: rounded shape, wing mirrors are part of the outline */}
        <path
          className="body"
          d="M22 90 C22 40 70 8 150 8 C230 8 278 40 278 90 L278 133 L296 146 Q303 150 303 156 L303 160 Q303 164 298 164 L278 164 L278 470 C278 530 240 556 150 556 C60 556 22 530 22 470 L22 164 L2 164 Q-3 164 -3 160 L-3 156 Q-3 150 4 146 L22 133 Z"
        />
        {/* hood: grille, gold headlights, creases */}
        <path className="grille" d="M112 16 C130 10 170 10 188 16 L182 34 C166 30 134 30 118 34 Z" />
        <path className="lamp" d="M44 58 C54 42 78 30 104 28 L98 60 C80 60 60 62 44 58 Z" />
        <path className="lamp" d="M256 58 C246 42 222 30 196 28 L202 60 C220 60 240 62 256 58 Z" />

        <path className="crease" d="M110 60 C104 80 104 96 108 104" />
        <path className="crease" d="M190 60 C196 80 196 96 192 104" />
        {/* glass: windscreen, side windows, rear window */}
        <path className="glass" d="M38 150 C58 112 104 98 150 98 C196 98 242 112 262 150 L250 196 C222 186 78 186 50 196 Z" />
        <path className="glass" d="M26 212 L47 198 L47 396 L28 420 Z" />
        <path className="glass" d="M274 212 L253 198 L253 396 L272 420 Z" />
        <path className="glass" d="M52 404 C80 410 220 410 248 404 L262 450 C236 466 190 472 150 472 C110 472 64 466 38 450 Z" />
        {/* door seam: thin body-coloured bar across each side window */}
        <path className="seam" d="M26 308 H47 M274 308 H253" />
        {/* roof (body colour) with a soft shine */}
        <path className="roof" d="M50 196 C78 186 222 186 250 196 L250 382 Q250 398 234 398 L66 398 Q50 398 50 382 Z" />
        <path className="shine" d="M52 300 C90 270 150 236 214 196 C236 192 246 194 250 196 L250 250 C200 300 130 360 66 398 Q52 396 52 382 Z" />
        {/* tail lights, number plate */}
        <path className="tail" d="M32 500 C36 526 52 540 76 542 L78 520 C60 520 44 512 32 500 Z" />
        <path className="tail" d="M268 500 C264 526 248 540 224 542 L222 520 C240 520 256 512 268 500 Z" />
        <rect className="plate" x="124" y="534" width="52" height="12" rx="3" />
      </svg>
      <div className="car-seats">
        {seatRows(slots).map((row, r) => (
          <div key={r} className={`seat-row n${row.length}`}>
            {row.map(({ p, i }) => (
              <Seat key={i} p={p} idx={i} carId={carId} dnd={dnd} pick={pick} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// one place in a tram group or taxi: tap / drag like a car seat; in groups the ticket icon picks the buyer
function Slot({ p, idx, boxId, kind, dnd, pick, t, buyer, onBuyer }) {
  const d = dnd.drag;
  const here = (x) => x && String(x.car) === String(boxId) && x.idx === idx;
  const fx = `${here(d) ? " is-dragging" : ""}${d && here(d.over) && !here(d) ? " is-over" : ""}${here(pick.picked) ? " is-picked" : ""}`;
  const tap = {
    "data-seat": `${boxId}:${idx}`,
    role: "button",
    tabIndex: 0,
    "aria-pressed": !!here(pick.picked),
    onClick: () => pick.onTap({ car: boxId, idx }, !!p),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick.onTap({ car: boxId, idx }, !!p);
      }
    },
  };
  if (!p) {
    return (
      <li className={`pp slot empty${fx}`} {...tap}>
        <span className="dot free"><Plus size={14} aria-hidden /></span>
        <span className="pp-name">{t.free}</span>
      </li>
    );
  }
  const Icon = kind === "taxi" ? Car : Train;
  return (
    <li
      className={`pp slot${fx}`}
      {...tap}
      onPointerDown={(e) => dnd.start(e, { car: boxId, idx }, p)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={`dot ${kind === "taxi" ? "car" : "train"}`}>
        <Icon size={15} aria-hidden />
      </span>
      <span className="pp-name">{p.name}</span>
      <TagDot p={p} className="lang-tag inline" />
      {p.note ? <NoteFlag note={p.note} inline /> : null}
      {kind === "tram" ? (
        <button
          className={`buy${buyer ? " on" : ""}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBuyer();
          }}
          aria-pressed={buyer}
          aria-label={`${t.makeBuyer}: ${p.name}`}
          title={t.makeBuyer}
        >
          <Ticket size={13} aria-hidden />
          {buyer ? <span>{t.buyer}</span> : null}
        </button>
      ) : null}
    </li>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="lim">
      <span>{label}</span>
      <span className="stepper small" role="group" aria-label={label}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−1"><Minus size={14} aria-hidden /></button>
        <strong>{value}</strong>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+1"><Plus size={14} aria-hidden /></button>
      </span>
    </div>
  );
}

// what forces a fresh plan: the leg, how the rest travels, and who drives how many seats.
// Everything else (people joining or leaving, group sizes) is merged into the manually edited layout.
const structKeyOf = (persons, leg, restBy, groupBy) =>
  `${leg}|${restBy}|${groupBy}|` + persons.filter((p) => p.legs[leg] && p.car).map((p) => `${p.id}:${p.seats}`).join(",");

const isDriverPos = (pos) => pos.car[0] === "c" && pos.idx === 0;
const clampLimit = (v, d, range = LIMIT_RANGE) => (Number.isInteger(v) && v >= range[0] && v <= range[1] ? v : d);

// ---------- section order + saved variants (a view preference: kept in localStorage, not part of the plan / undo) ----------
// the hero stays on top and rules / closing tile / footer stay at the bottom; these sections can be moved
const SECTION_KEYS = ["leg", "plan", "counts", "checks", "cars", "tram", "taxi", "people", "cards"];
const LAYOUT_STORE = "carpool-layouts-v1";
const normOrder = (o) => {
  const seen = new Set();
  const list = (Array.isArray(o) ? o : []).filter((k) => SECTION_KEYS.includes(k) && !seen.has(k) && seen.add(k));
  return [...list, ...SECTION_KEYS.filter((k) => !seen.has(k))];
};
const sameOrder = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);
function loadLayouts() {
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_STORE));
    if (s) {
      const variants = (Array.isArray(s.variants) ? s.variants : [])
        .filter((v) => v && v.id && typeof v.name === "string")
        .map((v) => ({ id: String(v.id), name: v.name, order: normOrder(v.order) }));
      return { variants, activeId: variants.some((v) => v.id === s.activeId) ? s.activeId : null, order: normOrder(s.order) };
    }
  } catch {}
  return { variants: [], activeId: null, order: SECTION_KEYS };
}

// thin bar above a section while the order is being changed
function MoveBar({ label, first, last, onUp, onDown, t }) {
  return (
    <div className="move-bar">
      <GripVertical size={16} aria-hidden />
      <span>{label}</span>
      <div>
        <button onClick={onUp} disabled={first} aria-label={`${t.up}: ${label}`} title={t.up}>
          <ArrowUp size={16} aria-hidden />
        </button>
        <button onClick={onDown} disabled={last} aria-label={`${t.down}: ${label}`} title={t.down}>
          <ArrowDown size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// departure time of one vehicle, always 24 h ("14:50"; the native time field would follow the browser's 12 h setting).
// Type digits: "1450", "930" or "9" -> 14:50, 09:30, 09:00. Empty = back to the time of the leg. Grey while it is the time of the leg.
function DepartTime({ value, base, label, onChange }) {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    const d = raw.replace(/\D/g, "");
    setDraft(null);
    if (!d) return onChange("");
    const hh = d.length <= 2 ? +d : d.length === 3 ? +d[0] : +d.slice(0, 2);
    const mm = d.length <= 2 ? 0 : +d.slice(d.length === 3 ? 1 : 2);
    if (hh < 24 && mm < 60) onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder="HH:MM"
      className={`time-input${draft === null && value === base ? " base" : ""}`}
      value={draft ?? value}
      aria-label={label}
      title={`${label} (24 h)`}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 4);
        setDraft(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// one custom rule: on/off, its sentence made of dropdowns, warning or info, delete
function RuleRow({ rule, persons, teams, t, onChange, onRemove }) {
  const set = (patch) => onChange({ ...rule, ...patch });
  const people = [...persons].sort((x, y) => x.name.localeCompare(y.name)).map((p) => ({ value: p.id, label: p.name }));
  return (
    <li className={`rule-row${rule.on ? "" : " off"}`}>
      <button
        className={`switch${rule.on ? " on" : ""}`}
        role="switch"
        aria-checked={rule.on}
        aria-label={t.ruleOn}
        title={t.ruleOn}
        onClick={() => set({ on: !rule.on })}
      >
        <i className="track">
          <span />
        </i>
        <b>{rule.on ? t.ruleActive : t.ruleInactive}</b>
      </button>
      <div className="rule-body">
        {rule.type === "pair" ? (
          <>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.a} options={people.filter((o) => o.value !== rule.b)} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ a: v })} />
            <span>{t.pairWith}</span>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.b} options={people.filter((o) => o.value !== rule.a)} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ b: v })} />
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.mode}
              options={[
                { value: "together", label: t.pairTogether },
                { value: "apart", label: t.pairApart },
              ]}
              onValueChange={(v) => set({ mode: v })}
            />
          </>
        ) : null}
        {rule.type === "lang" ? (
          <>
            <span>{t.ruleLangA}</span>
            <LangSelect disabled={!rule.on} noClear value={rule.lang} options={LANG_OPTIONS.map((l) => ({ value: l, label: l }))} label={t.langCol} onValueChange={(v) => set({ lang: v })} />
          </>
        ) : null}
        {rule.type === "teamMax" ? (
          <>
            <span>{t.ruleTeamA}</span>
            <LangSelect disabled={!rule.on} noClear value={String(rule.max)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} label="max" onValueChange={(v) => set({ max: Number(v) })} />
            <span>{t.ruleTeamB}</span>
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.team}
              options={[{ value: "*", label: t.allTeams }, ...teams.map((x) => ({ value: x, label: x }))]}
              label={t.team}
              onValueChange={(v) => set({ team: v })}
            />
          </>
        ) : null}
        {rule.type === "note" ? (
          <>
            <span>{t.noteRuleA}</span>
            <input
              key={rule.id + rule.keyword}
              className="cell-input keyword"
              defaultValue={rule.keyword}
              maxLength={30}
              placeholder={t.keyword}
              aria-label={t.keyword}
              disabled={!rule.on}
              onBlur={(e) => e.target.value.trim() !== rule.keyword && set({ keyword: e.target.value.trim() })}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <LangSelect
              disabled={!rule.on}
              noClear
              className="wide"
              value={rule.rule}
              options={[
                { value: "noTaxi", label: t.personNoTaxi },
                { value: "noTram", label: t.personNoTram },
                { value: "inCar", label: t.personInCar },
                { value: "notAlone", label: t.personNotAlone },
              ]}
              onValueChange={(v) => set({ rule: v })}
            />
          </>
        ) : null}
        {rule.type === "person" ? (
          <>
            <LangSelect disabled={!rule.on} noClear className="wide" value={rule.p} options={people} placeholder={t.pickPerson} label={t.pickPerson} onValueChange={(v) => set({ p: v })} />
            <LangSelect disabled={!rule.on}
              noClear
              className="wide"
              value={rule.rule}
              options={[
                { value: "noTaxi", label: t.personNoTaxi },
                { value: "noTram", label: t.personNoTram },
                { value: "inCar", label: t.personInCar },
                { value: "notAlone", label: t.personNotAlone },
              ]}
              onValueChange={(v) => set({ rule: v })}
            />
          </>
        ) : null}
      </div>
      <div className="rule-end">
        <button
          className={`lvl ${rule.level}`}
          disabled={!rule.on}
          onClick={() => set({ level: rule.level === "warn" ? "info" : "warn" })}
          title={`${rule.level === "warn" ? t.levelWarn : t.levelInfo} – ${t.levelToggle}`}
          aria-label={`${rule.level === "warn" ? t.levelWarn : t.levelInfo} – ${t.levelToggle}`}
        >
          {rule.level === "warn" ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}
        </button>
        <button className="icon-btn" onClick={onRemove} aria-label={t.ruleRemove} title={t.ruleRemove}>
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}

// everything that is saved and can be undone lives in one document
// an older saved test list (4 teams) gets the current test teams; lists with own teams are left alone
function refreshTestTeams(persons) {
  const demo = new Map(defaultPersons().map((p) => [p.id, p]));
  const isDemo = (p) => demo.has(p.id) && demo.get(p.id).name === p.name;
  const old = new Set(["", "SAP PE", "TRBK", "Marketing", "Projektleitung"]);
  const mine = persons.filter(isDemo);
  if (!mine.length || !mine.every((p) => old.has(p.team))) return persons;
  return persons.map((p) => (isDemo(p) ? { ...p, team: demo.get(p.id).team, lang: p.lang || demo.get(p.id).lang } : p));
}

const initialDoc = (saved) => ({
  persons: refreshTestTeams((saved?.persons || defaultPersons()).map((p) => ({ team: "", note: "", ...p, lang: normLang(p.lang) }))),
  restBy: saved?.restBy === "taxi" ? "taxi" : "tram",
  groupBy: ["team", "lang"].includes(saved?.groupBy) ? saved.groupBy : "none",
  limits: {
    groupMax: clampLimit(saved?.limits?.groupMax, DEFAULT_LIMITS.groupMax),
    taxiSeats: clampLimit(saved?.limits?.taxiSeats, DEFAULT_LIMITS.taxiSeats, TAXI_RANGE),
  },
  edits: saved?.edits || {}, // { [leg]: { key, layout } }
  rules: cleanRules(saved?.rules), // custom checks, saved with the plan
});

function docReducer(state, a) {
  const keep = 60;
  if (a.type === "undo") {
    if (!state.past.length) return state;
    return { doc: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.doc, ...state.future] };
  }
  if (a.type === "redo") {
    if (!state.future.length) return state;
    return { doc: state.future[0], past: [...state.past, state.doc], future: state.future.slice(1) };
  }
  const next = a.fn(state.doc);
  if (next === state.doc) return state;
  return { doc: next, past: [...state.past.slice(-(keep - 1)), state.doc], future: [] };
}

export default function CarpoolApp() {
  const [lang, setLang] = useLang();
  const t = TEXT[lang];
  const saved = useMemo(loadState, []);
  const [hist, dispatch] = useReducer(docReducer, null, () => ({ doc: initialDoc(saved), past: [], future: [] }));
  const { persons, restBy, groupBy, limits, edits, rules } = hist.doc;
  const setField = (key) => (v) =>
    dispatch({ type: "set", fn: (d) => { const nv = typeof v === "function" ? v(d[key]) : v; return nv === d[key] ? d : { ...d, [key]: nv }; } });
  const setPersons = setField("persons");
  const setRestBy = setField("restBy");
  const setGroupBy = setField("groupBy");
  const setLimits = setField("limits");
  const setEdits = setField("edits");
  const setRules = setField("rules");
  const setDoc = (patch) => dispatch({ type: "set", fn: (d) => ({ ...d, ...patch }) });
  const [leg, setLeg] = useState(saved?.leg === 1 ? 1 : 0);
  const [filter, setFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [newName, setNewName] = useState("");
  const [picked, setPicked] = useState(null); // { car: boxId, idx } of the person chosen by tapping
  const [note, setNote] = useState(""); // short confirmation ("copied", "saved")
  const fileRef = useRef(null);
  const planRef = useRef(null);
  const [layoutState, setLayoutState] = useState(loadLayouts); // { variants, activeId, order }
  const [layoutEdit, setLayoutEdit] = useState(false); // show the move bars
  const [rulesOpen, setRulesOpen] = useState(false); // popup with the custom rules
  const [renaming, setRenaming] = useState(null); // id of the variant whose name is being edited in the bar
  const [drawerOpen, setDrawerOpen] = useState(false); // side menu on tablet / phone
  const [drawerClosing, setDrawerClosing] = useState(false); // true while it slides out
  const drawerTimer = useRef(0);
  const closeDrawerRef = useRef(() => {});
  const DRAWER_MS = 320;
  const openDrawer = () => {
    clearTimeout(drawerTimer.current);
    setDrawerClosing(false);
    setDrawerOpen(true);
  };
  // slides out first, removes the menu afterwards; `after` runs once it is gone
  const closeDrawer = (after) => {
    if (drawerClosing) return;
    setDrawerClosing(true);
    drawerTimer.current = setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
      if (typeof after === "function") after();
    }, DRAWER_MS);
  };
  closeDrawerRef.current = closeDrawer;
  const [scrolled, setScrolled] = useState(false); // navbar gets a shadow once the page is scrolled
  const [activeSec, setActiveSec] = useState(""); // section that is in view (highlighted in the menus)
  const [layoutPast, setLayoutPast] = useState([]); // earlier orders of this editing session (for the undo button)
  // while the popup is open the page behind it does not scroll (the popup itself does)
  useEffect(() => {
    if (!rulesOpen && !drawerOpen) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const esc = (e) => {
      if (e.key !== "Escape") return;
      setRulesOpen(false);
      closeDrawerRef.current();
    };
    window.addEventListener("keydown", esc);
    return () => {
      html.style.overflow = prev[0];
      document.body.style.overflow = prev[1];
      window.removeEventListener("keydown", esc);
    };
  }, [rulesOpen, drawerOpen]);
  // shadow under the navbar and the section that is currently in view
  useEffect(() => {
    const ids = ["checks", "cars", "tram", "taxi", "all", "cards"];
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
      let cur = "";
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      });
      setActiveSec(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORE, JSON.stringify(layoutState));
    } catch {}
  }, [layoutState]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...hist.doc, leg }));
    } catch {}
  }, [hist.doc, leg]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 2200);
    return () => clearTimeout(id);
  }, [note]);
  const undo = () => {
    dispatch({ type: "undo" });
    setPicked(null);
  };
  const redo = () => {
    dispatch({ type: "redo" });
    setPicked(null);
  };
  useEffect(() => {
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // layout of both legs: planned automatically, then the manual edits of that leg merged in
  const layouts = useMemo(
    () =>
      LEGS.map((_, l) => {
        const key = structKeyOf(persons, l, restBy, groupBy);
        const e = edits[l];
        if (e && e.key === key && e.layout) {
          const riders = persons.filter((p) => p.legs[l] && !p.car).map((p) => p.id);
          return { key, layout: reconcileLayout(e.layout, riders, limits, restBy), away: persons.filter((p) => !p.legs[l]).length };
        }
        const plan = planLeg(persons, l, restBy, limits, groupBy);
        return { key, layout: baseLayout(plan, limits), away: plan.away };
      }),
    [persons, restBy, limits, groupBy, edits]
  );
  const { key: planKey, layout, away } = layouts[leg];
  const { boxes, order, buyers } = layout;
  const times = layout.times || {};
  const L = LEGS[leg];
  const from = L.from.name[lang];
  const to = L.to.name[lang];

  useEffect(() => setPicked(null), [planKey, leg]);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  const byId = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);

  // team / language colours (the table also colours by team while no grouping is chosen)
  const filterBy = groupBy === "none" ? "team" : groupBy;
  const tagInfo = useMemo(() => tagColors(persons, filterBy), [persons, filterBy]);
  const tagCtx = useMemo(
    () => ({ by: groupBy, of: (p) => tagOf(p, groupBy), color: tagInfo.color, title: (p) => [p.team, p.lang].filter(Boolean).join(" · ") }),
    [groupBy, tagInfo]
  );
  useEffect(() => setTagFilter(null), [groupBy]);

  // change the layout of the chosen leg by hand (fn gets a copy)
  const editLayout = (fn) => {
    const copy = {
      boxes: Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, [...v]])),
      order: { cars: [...order.cars], groups: [...order.groups], taxis: [...order.taxis] },
      buyers: { ...buyers },
      times: { ...times },
    };
    setEdits((prev) => ({ ...prev, [leg]: { key: planKey, layout: fixBuyers(fn(copy) || copy) } }));
  };

  // move a person to a free place or swap two people (cars, tram groups, taxis); drivers never move
  const swapSeats = (a, b) => {
    if (isDriverPos(a) || isDriverPos(b)) return;
    editLayout((l) => {
      const tmp = l.boxes[a.car][a.idx];
      l.boxes[a.car][a.idx] = l.boxes[b.car][b.idx];
      l.boxes[b.car][b.idx] = tmp;
    });
  };
  const setTime = (id, value) =>
    editLayout((l) => {
      if (!value || value === L.time) delete l.times[id];
      else l.times[id] = value;
    });
  // leg 2 starts from the cars, groups and taxis of leg 1 (can be undone)
  const copyLeg = () => {
    setEdits((prev) => ({ ...prev, 1: { key: structKeyOf(persons, 1, restBy, groupBy), layout: copyLayoutToLeg(layouts[0].layout, persons, 1) } }));
    if (leg !== 1) setLeg(1);
    setNote(t.legCopied);
  };
  const setBuyer = (gid, pid) => editLayout((l) => void (l.buyers[gid] = pid));
  const addBox = (kind) =>
    editLayout((l) => {
      const id = newBoxId(l, kind === "groups" ? "g" : "t");
      l.boxes[id] = Array(kind === "groups" ? limits.groupMax : limits.taxiSeats).fill(null);
      l.order[kind].push(id);
    });
  // set the number of tram groups: everybody in a group is spread evenly over the new number
  const setGroupCount = (n) =>
    editLayout((l) => {
      const members = l.order.groups.flatMap((g) => l.boxes[g].filter(Boolean));
      const total = members.length;
      const ids = l.order.groups.slice(0, n);
      l.order.groups.slice(n).forEach((g) => delete l.boxes[g]);
      while (ids.length < n) ids.push(newBoxId({ boxes: { ...l.boxes, ...Object.fromEntries(ids.map((i) => [i, 0])) } }, "g"));
      l.order.groups = ids;
      ids.forEach((g, i) => {
        const size = Math.floor(total / n) + (i < total % n ? 1 : 0);
        const mine = members.splice(0, size);
        l.boxes[g] = [...mine, ...Array(limits.groupMax - mine.length).fill(null)];
      });
    });
  const removeBox = (kind, id) =>
    editLayout((l) => {
      if (l.boxes[id].some(Boolean)) return;
      delete l.boxes[id];
      l.order[kind] = l.order[kind].filter((x) => x !== id);
    });
  const dnd = useSeatDrag(swapSeats);
  // a drag cancels a tap selection; the click that ends a drag on its own seat must not select again
  const lastDrag = useRef(0);
  useEffect(() => {
    if (!dnd.drag) return;
    setPicked(null);
    return () => {
      lastDrag.current = Date.now();
    };
  }, [!!dnd.drag]);

  // tap a person, then a place: move or swap. Tapping the chosen one again cancels. Driver seats do nothing.
  const onTap = (pos, hasPerson) => {
    if (Date.now() - lastDrag.current < 150) return;
    if (!picked) {
      if (hasPerson && !isDriverPos(pos)) setPicked(pos);
      return;
    }
    if (String(picked.car) === String(pos.car) && picked.idx === pos.idx) {
      setPicked(null);
      return;
    }
    swapSeats(picked, pos);
    setPicked(null);
  };
  const pick = { picked, onTap };
  const pickedPerson = picked ? byId[boxes[picked.car]?.[picked.idx]] : null;
  const filled = (id) => boxes[id].filter(Boolean).length;

  // ---------- roster actions ----------
  const patch = (id, change) => setPersons((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const toggleLeg = (p, i) => patch(p.id, { legs: p.legs.map((v, j) => (j === i ? !v : v)) });
  const removePerson = (id) => setPersons((ps) => ps.filter((p) => p.id !== id));
  const addPerson = (name) => setPersons((ps) => [...ps, newPerson(name || nextName(ps))]);
  const setCount = (n) =>
    setPersons((ps) => {
      let list = [...ps];
      while (list.length < n) list.push(newPerson(nextName(list)));
      while (list.length > n) {
        // drop the last person without a car first
        const i = list.map((p) => p.car).lastIndexOf(false);
        list.splice(i === -1 ? list.length - 1 : i, 1);
      }
      return list;
    });
  const submitAdd = (e) => {
    e.preventDefault();
    addPerson(newName.trim());
    setNewName("");
  };
  const loadFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const list = parseRoster(String(r.result));
      if (!list.length) return window.alert(t.csvEmpty);
      if (window.confirm(t.replaceAsk(list.length))) {
        // rules about named people no longer fit a new list
        setDoc({ persons: list, edits: {}, rules: rules.filter((r) => r.type !== "pair" && r.type !== "person") });
      }
    };
    r.readAsText(f, "utf-8");
  };
  const resetData = () => {
    if (!window.confirm(t.resetAsk)) return;
    setDoc({ persons: defaultPersons(), edits: {}, limits: DEFAULT_LIMITS, restBy: "tram", groupBy: "none", rules: [] });
  };

  // every placed person of a layout, in plan order, with label and role (assignment table + export)
  const entriesOf = (lay) => {
    const out = [];
    lay.order.cars.forEach((id, n) =>
      lay.boxes[id].forEach((pid, i) => pid && out.push({ pid, kind: "car", label: `${t.car} ${n + 1}`, role: i === 0 ? t.driver : "" }))
    );
    lay.order.groups.forEach((id, n) =>
      lay.boxes[id].forEach((pid) => pid && out.push({ pid, kind: "tram", label: `${t.group} ${n + 1}`, role: lay.buyers[id] === pid ? t.buyer : "" }))
    );
    lay.order.taxis.forEach((id, n) =>
      lay.boxes[id].forEach((pid) => pid && out.push({ pid, kind: "taxi", label: `${t.taxi} ${n + 1}`, role: "" }))
    );
    return out;
  };
  const assignment = useMemo(() => new Map(entriesOf(layout).map((e) => [e.pid, e])), [layout, t]);
  const count = useMemo(() => {
    const c = { car: 0, tram: 0, taxi: 0 };
    entriesOf(layout).forEach((e) => c[e.kind]++);
    return c;
  }, [layout, t]);
  const checks = useMemo(() => computeChecks({ persons, layouts, groupBy, limits, rules }), [persons, layouts, groupBy, limits, rules]);
  const addRule = (type) => setRules((rs) => [...rs, newRule(type)]);
  const changeRule = (r) => setRules((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  const removeRule = (id) => setRules((rs) => rs.filter((x) => x.id !== id));
  const teamList = [...new Set(persons.map((p) => p.team).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const CHECK_TARGET = { noPeople: "all", carNotThere: "all", emptyCar: "cars", freeSeats: "cars", mixed: "cars", smallGroup: "tram", lonelyTaxi: "taxi" };
  const goToCheck = (c) => {
    const kindTarget = { car: "cars", group: "tram", taxi: "taxi" };
    const ruleTarget = c.args.type === "person" || c.args.type === "note" ? (c.args.rule === "noTaxi" ? "taxi" : c.args.rule === "noTram" ? "tram" : c.args.rule === "notAlone" ? kindTarget[c.args.kind] || "cars" : "cars") : "cars";
    const target = c.code === "emptyBox" ? (c.args.kind === "group" ? "tram" : "taxi") : c.code === "rule" ? ruleTarget : CHECK_TARGET[c.code] || "all";
    if (c.leg !== leg) setLeg(c.leg);
    // wait one tick so the other leg is rendered before scrolling
    setTimeout(() => {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }, c.leg !== leg ? 80 : 0);
  };
  const warns = checks.filter((c) => c.level === "warn").length;
  const legCards = useMemo(() => LEGS.map((lg, l) => ({ lg, l, cards: buildCards(layouts[l].layout, byId, t) })), [layouts, byId, t]);
  const legHead = (lg, l) => `${t.leg} ${l + 1} · ${lg.time} ${t.oclock} · ${lg.from.name[lang]} → ${lg.to.name[lang]}`.replace("  ", " ");
  const copyCards = async (text, label) => setNote((await copyText(text)) ? label : "");
  const savePlan = () => {
    const blob = new Blob([JSON.stringify({ app: "carpool", version: 1, saved: new Date().toISOString(), doc: hist.doc }, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carpool-plan-${EVENT.date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(t.planSaved);
  };
  const loadPlan = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.xlsx$/i.test(f.name)) {
      (async () => {
        try {
          const { readPlanFromExcel } = await import("./excelImport.js");
          const res = await readPlanFromExcel(f, { legs: LEGS, limits, keyOf: (ps, l) => structKeyOf(ps, l, restBy, groupBy) });
          // rules about named people no longer fit the new list
          if (window.confirm(t.planAsk)) setDoc({ persons: res.persons, edits: res.edits, rules: rules.filter((r) => r.type !== "pair" && r.type !== "person") });
        } catch (err) {
          console.error(err);
          window.alert(t.planBad);
        }
      })();
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        const ps = d?.doc?.persons;
        if (d?.app !== "carpool" || !Array.isArray(ps) || !ps.every((p) => p && p.id && p.name && Array.isArray(p.legs))) throw new Error("bad");
        if (window.confirm(t.planAsk)) dispatch({ type: "set", fn: () => initialDoc(d.doc) });
      } catch {
        window.alert(t.planBad);
      }
    };
    r.readAsText(f, "utf-8");
  };
  const groupPeople = order.groups.reduce((n, id) => n + filled(id), 0);
  // how many go by car / tram / taxi: the mode that absorbs the change is the one the rest travels by
  const total = count.car + count.tram + count.taxi;
  const carMin = order.cars.length;
  const carMax = order.cars.reduce((n, id) => n + boxes[id].length, 0);
  const setCounts = (mode, v) => {
    let { car, tram, taxi } = count;
    const rest = () => total - car;
    if (mode === "car") {
      car = v;
      if (restBy === "taxi") {
        taxi = rest() - tram;
        if (taxi < 0) { taxi = 0; tram = rest(); }
      } else {
        tram = rest() - taxi;
        if (tram < 0) { tram = 0; taxi = rest(); }
      }
    } else if (mode === "tram") {
      tram = v;
      taxi = rest() - tram;
    } else {
      taxi = v;
      tram = rest() - taxi;
    }
    editLayout((l) => applyCounts(l, { car, tram, taxi }, limits));
  };
  const tickets = order.groups.filter((id) => filled(id) > 0).length;

  // the plan as an Excel workbook (overview, one sheet per leg, people with filters, hints)
  const exportPlan = async () => {
    try {
      const { buildWorkbook } = await import("./excel.js");
      const blob = await buildWorkbook({ persons, layouts, legs: LEGS, lang, t, checks, date: eventDateShort });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transfer-plan-${EVENT.date}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      window.alert(t.exportFailed);
    }
  };

  const eventDateShort = new Date(EVENT.date + "T12:00:00").toLocaleDateString(lang === "de" ? "de-DE" : "en-GB");
  const eventDate = new Date(EVENT.date + "T12:00:00").toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const onLeg = persons.length - away;
  const rows = persons.filter((p) => {
    const a = assignment.get(p.id);
    if (tagFilter && tagOf(p, filterBy) !== tagFilter) return false;
    if (filter === "all") return true;
    if (filter === "away") return !p.legs[leg];
    if (filter === "driver") return p.car && p.legs[leg];
    return a?.kind === filter;
  });

  // section order + variants
  const { variants, activeId, order: sectionOrder } = layoutState;
  const activeVariant = variants.find((v) => v.id === activeId) || null;
  const layoutDirty = !sameOrder(sectionOrder, activeVariant ? activeVariant.order : SECTION_KEYS);
  const setOrder = (order) => setLayoutState((s) => ({ ...s, order }));
  const moveSection = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sectionOrder.length) return;
    const o = [...sectionOrder];
    [o[i], o[j]] = [o[j], o[i]];
    setLayoutPast((p) => [...p.slice(-30), sectionOrder]);
    setOrder(o);
  };
  const undoOrder = () => {
    if (!layoutPast.length) return;
    const prev = layoutPast[layoutPast.length - 1];
    setLayoutPast((p) => p.slice(0, -1));
    setOrder(prev);
  };
  const applyVariant = (id) => {
    setLayoutPast((p) => [...p.slice(-30), sectionOrder]);
    setLayoutState((s) => {
      const v = s.variants.find((x) => x.id === id);
      return { ...s, activeId: v ? v.id : null, order: v ? v.order : SECTION_KEYS };
    });
  };
  const saveVariantAs = () => {
    // no question: the variant is named "Variante N" (next free number)
    const used = new Set(variants.map((v) => v.name));
    let n = variants.length + 1;
    while (used.has(`${t.variant} ${n}`)) n++;
    const name = `${t.variant} ${n}`;
    const id = `v${Date.now().toString(36)}`;
    setLayoutState((s) => ({ ...s, variants: [...s.variants, { id, name, order: s.order }], activeId: id }));
    setRenaming(id);
  };
  const updateVariant = () => {
    if (!activeVariant) return;
    setLayoutState((s) => ({ ...s, variants: s.variants.map((v) => (v.id === s.activeId ? { ...v, order: s.order } : v)) }));
    setNote(t.variantSaved);
  };
  const renameVariant = (id, name) => {
    const n = name.trim();
    if (n) setLayoutState((s) => ({ ...s, variants: s.variants.map((v) => (v.id === id ? { ...v, name: n } : v)) }));
    setRenaming(null);
  };
  const deleteVariant = () => {
    if (!activeVariant) return;
    setLayoutState((s) => ({ ...s, variants: s.variants.filter((v) => v.id !== s.activeId), activeId: null }));
  };

  const SECTIONS = {
    checks: { id: "checks", icon: ListChecks, label: t.checksH, nav: t.navChecks, count: checks.length },
    cars: { id: "cars", icon: Car, label: t.carsH, nav: t.navCars, count: count.car },
    tram: { id: "tram", icon: Train, label: t.tramH, nav: t.navTram, count: count.tram },
    taxi: { id: "taxi", icon: CarTaxiFront, label: t.taxiH, nav: t.navTaxi, count: count.taxi },
    people: { id: "all", icon: Users, label: t.allH, nav: t.navAll, count: persons.length },
    cards: { id: "cards", icon: MessageSquareText, label: t.cardsH, nav: t.navCards, count: legCards[leg].cards.length },
  };
  const sectionLinks = sectionOrder.map((k) => SECTIONS[k]).filter(Boolean);

  const blocks = {
    leg: (
            <div className="tile cp-bar bar-leg">
              <span className="cp-bar-label">{t.leg}</span>
              <div className="pill-field">
                <div className="seg" role="group" aria-label={t.leg}>
                  {LEGS.map((lg, i) => (
                    <button key={i} className={i === leg ? "on" : ""} onClick={() => setLeg(i)} aria-pressed={i === leg}>
                      {i + 1} · {lg.time}
                    </button>
                  ))}
                </div>
                <div className="field-group">
                  <span>{t.restBy}</span>
                  <div className="seg" role="group" aria-label={t.restBy}>
                    {[
                      ["tram", "Tram"],
                      ["taxi", "Taxi"],
                    ].map(([k, label]) => (
                      <button key={k} className={restBy === k ? "on" : ""} onClick={() => setRestBy(k)} aria-pressed={restBy === k}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn-grad" onClick={exportPlan}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
            </div>
    ),
    plan: (
            <div className="tile cp-bar bar-plan">
              <span className="cp-bar-label">{t.optionsLabel}</span>
              <div className="pill-field">
                <div className="field-group">
                <span>{t.groupBy}</span>
                <div className="seg" role="group" aria-label={t.groupBy}>
                  {[
                    ["none", t.groupNone],
                    ["team", t.groupTeam],
                    ["lang", t.groupLang],
                  ].map(([k, label]) => (
                    <button key={k} className={groupBy === k ? "on" : ""} onClick={() => setGroupBy(k)} aria-pressed={groupBy === k}>
                      {label}
                    </button>
                  ))}
                </div>
                </div>
              </div>
              <div className="bar-actions">
                <div className="bar-undo">
                  <button className="ghost icon-only" onClick={undo} disabled={!hist.past.length} aria-label={t.undo} title={`${t.undo} (Ctrl+Z)`}>
                    <Undo2 size={17} aria-hidden />
                  </button>
                  <button className="ghost icon-only" onClick={redo} disabled={!hist.future.length} aria-label={t.redo} title={`${t.redo} (Ctrl+Y)`}>
                    <Redo2 size={17} aria-hidden />
                  </button>
                </div>
                <div className="bar-files">
                  <button className="ghost" onClick={savePlan} title={t.planHint}>
                    <Save size={15} aria-hidden /> {t.savePlan}
                  </button>
                  <button className="ghost" onClick={() => planRef.current?.click()} title={t.planHint}>
                    <FolderOpen size={15} aria-hidden /> {t.loadPlan}
                  </button>
                  <button className="ghost" onClick={copyLeg} title={t.copyLegTip}>
                    <Copy size={15} aria-hidden /> {t.copyLeg2}
                  </button>
                </div>
                <input ref={planRef} type="file" accept=".json,application/json,.xlsx" onChange={loadPlan} hidden />
              </div>
            </div>
    ),
    counts: (
            <Reveal as="div" className="cp-counts">
              {[
                ["car", count.car, t.byCar, carMin, Math.min(carMax, total)],
                ["tram", count.tram, t.byTram, 0, total - count.car],
                ["taxi", count.taxi, t.byTaxi, 0, total - count.car],
              ].map(([k, n, label, min, max]) => (
                <div key={k} className={`count c-${k}`}>
                  <div className="count-ctl" role="group" aria-label={label}>
                    <button onClick={() => setCounts(k, n - 1)} disabled={n <= min} aria-label={`${label} −1`}><Minus size={16} aria-hidden /></button>
                    <button onClick={() => setCounts(k, n + 1)} disabled={n >= max} aria-label={`${label} +1`}><Plus size={16} aria-hidden /></button>
                  </div>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </Reveal>
    ),
    checks: (
            <Reveal id="checks" className="tile">
              <div className="checks-head">
                <h2 className="tile-title">{t.checksH}</h2>
                {/* every hint is counted, warnings and infos alike; peach while there is a warning */}
                <span className={`warn-badge${warns ? "" : " calm"}`}>{checks.length}</span>
                <button className="ghost rules-open" onClick={() => setRulesOpen(true)} aria-haspopup="dialog">
                  <ListPlus size={15} aria-hidden /> {t.rulesBtn}
                  {rules.some(ruleReady) ? ` (${rules.filter(ruleReady).length})` : ""}
                </button>
              </div>
              <p className="tile-note">{t.checksSub}</p>
              {checks.length ? (
                <ul className="check-list">
                  {checks.map((c, i) => (
                    <li
                      key={i}
                      className={`check go ${c.level}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToCheck(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToCheck(c);
                        }
                      }}
                    >
                      <span className="check-icon">{c.level === "warn" ? <TriangleAlert size={16} aria-hidden /> : <Info size={16} aria-hidden />}</span>
                      <span className="check-leg">{t.legWord} {c.leg + 1}</span>
                      <span className="check-text">{t.chk[c.code](c.args, t.kinds)}</span>
                      <ArrowRight className="check-go" size={16} aria-hidden />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="check ok">
                  <span className="check-icon"><CircleCheck size={18} aria-hidden /></span> {t.noIssues}
                </p>
              )}
            </Reveal>
    ),
    cars: (
            <Reveal id="cars" className="tile">
              <h2 className="tile-title">{t.carsH} ({count.car})</h2>
              <p className="tile-note">{t.carsSub}</p>
              {order.cars.length ? (
                <>
                  <p className="tile-note drag-hint">{t.moveHint}</p>
                  <div className="plan-grid">
                    {order.cars.map((id, n) => (
                      <article key={id} className="pcard">
                        <div className="pcard-head">
                          <h3>{t.car} {n + 1}</h3>
                          <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                          <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        </div>
                        <CarMap carId={id} slots={boxes[id].map((pid) => (pid ? byId[pid] : null))} dnd={dnd} pick={pick} t={t} />
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="tile-note">{t.noCars}</p>
              )}
            </Reveal>
    ),
    tram: (
            <Reveal id="tram" className="tile">
              <h2 className="tile-title">{t.tramH} ({count.tram})</h2>
              <p className="tile-note">{t.tramSub(from)}</p>
              <div className="box-tools">
                <Stepper label={t.groupCount} value={order.groups.length} min={groupPeople ? Math.ceil(groupPeople / limits.groupMax) : 0} max={groupPeople ? groupPeople : LIMIT_RANGE[1]} onChange={setGroupCount} />
                <Stepper label={t.groupSize} value={limits.groupMax} min={LIMIT_RANGE[0]} max={LIMIT_RANGE[1]} onChange={(v) => setLimits((l) => ({ ...l, groupMax: v }))} />
                <span className="chip-static hide-m"><Ticket size={14} aria-hidden /> {t.tickets(tickets)}</span>
              </div>
              {order.groups.length ? (
                <div className="plan-grid">
                  {order.groups.map((id, n) => (
                    <article key={id} className="pcard">
                      <div className="pcard-head">
                        <h3>{t.group} {n + 1}</h3>
                        <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                        <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        {filled(id) === 0 ? (
                          <button className="icon-btn" onClick={() => removeBox("groups", id)} aria-label={t.removeBox} title={t.removeBox}>
                            <X size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <ul>
                        {boxes[id].map((pid, i) => (
                          <Slot
                            key={i}
                            p={pid ? byId[pid] : null}
                            idx={i}
                            boxId={id}
                            kind="tram"
                            dnd={dnd}
                            pick={pick}
                            t={t}
                            buyer={pid && buyers[id] === pid}
                            onBuyer={() => setBuyer(id, pid)}
                          />
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tile-note">{t.nothing}</p>
              )}
            </Reveal>
    ),
    taxi: (
            <Reveal id="taxi" className="tile">
              <h2 className="tile-title">{t.taxiH} ({count.taxi})</h2>
              <p className="tile-note">{t.taxiSub}</p>
              <div className="box-tools">
                <Stepper label={t.taxiSize} value={limits.taxiSeats} min={TAXI_RANGE[0]} max={TAXI_RANGE[1]} onChange={(v) => setLimits((l) => ({ ...l, taxiSeats: v }))} />
                <button className="ghost" onClick={() => addBox("taxis")}>
                  <Plus size={15} aria-hidden /> {t.addTaxi}
                </button>
              </div>
              {order.taxis.length ? (
                <div className="plan-grid">
                  {order.taxis.map((id, n) => (
                    <article key={id} className="pcard">
                      <div className="pcard-head">
                        <h3>{t.taxi} {n + 1}</h3>
                        <DepartTime value={times[id] || L.time} base={L.time} label={t.departAt} onChange={(v) => setTime(id, v)} />
                        <span className="pcard-fill">{filled(id)}/{boxes[id].length}</span>
                        {filled(id) === 0 ? (
                          <button className="icon-btn" onClick={() => removeBox("taxis", id)} aria-label={t.removeBox} title={t.removeBox}>
                            <X size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <ul>
                        {boxes[id].map((pid, i) => (
                          <Slot key={i} p={pid ? byId[pid] : null} idx={i} boxId={id} kind="taxi" dnd={dnd} pick={pick} t={t} />
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="tile-note">{t.nothing}</p>
              )}
            </Reveal>
    ),
    people: (
            <Reveal id="all" className="tile">
              <h2 className="tile-title">{t.allH} ({rows.length})</h2>
              <p className="tile-note">{t.allSub}</p>

              <div className="roster-tools">
                <div className="stepper" role="group" aria-label={t.count}>
                  <button onClick={() => setCount(Math.max(1, persons.length - 1))} aria-label="−1"><Minus size={16} aria-hidden /></button>
                  <strong>{persons.length}</strong>
                  <button onClick={() => setCount(persons.length + 1)} aria-label="+1"><Plus size={16} aria-hidden /></button>
                </div>
                <form className="add-form" onSubmit={submitAdd}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.addPh} aria-label={t.addPh} />
                  <button type="submit" className="ghost">{t.add}</button>
                </form>
                <button className="ghost" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} aria-hidden /> {t.load}
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={loadFile} hidden />
                <button className="ghost" onClick={resetData}>
                  <RotateCcw size={15} aria-hidden /> {t.reset}
                </button>
              </div>
              <p className="tile-note csv-hint">{t.csvHint}</p>

              <div className="cp-filter" role="group">
                {[
                  ["all", t.filterAll],
                  ["car", t.car],
                  ["driver", t.driver],
                  ["tram", "Tram"],
                  ["taxi", t.taxi],
                  ["away", t.filterAway],
                ].map(([k, label]) => (
                  <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} aria-pressed={filter === k}>
                    {label}
                  </button>
                ))}
              </div>
              {tagInfo.values.length ? (
                <div className="cp-filter tags" role="group">
                  {[null, ...tagInfo.values].map((v) => (
                    <button key={v ?? "all"} className={tagFilter === v ? "on" : ""} onClick={() => setTagFilter(v)} aria-pressed={tagFilter === v}>
                      {v ? <i style={{ background: tagInfo.color(v) }} /> : null}
                      {v ?? `${filterBy === "lang" ? t.langCol : t.team}: ${t.all}`}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t.name}</th>
                      <th>{t.team}</th>
                      <th>{t.langCol}</th>
                      <th>{t.noteCol}</th>
                      <th>{t.mode}</th>
                      {LEGS.map((lg, i) => (
                        <th key={i}>{t.leg} {i + 1}</th>
                      ))}
                      <th>{t.assign}</th>
                      <th aria-label={t.remove} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const a = assignment.get(p.id);
                      const idx = persons.indexOf(p) + 1;
                      return (
                        <tr key={p.id} className={p.legs[leg] ? "" : "is-away"}>
                          <td className="c-num" data-label="#">{idx}</td>
                          <td data-label={t.name}>{p.name}</td>
                          <td data-label={t.team}>
                            <LangSelect
                              className="wide"
                              value={p.team}
                              onValueChange={(v) => patch(p.id, { team: v })}
                              options={[...new Set([...persons.map((q) => q.team), p.team].filter(Boolean))]
                                .sort((x, y) => x.localeCompare(y))
                                .map((v) => ({ value: v, label: v }))}
                              label={`${t.team}: ${p.name}`}
                            />
                          </td>
                          <td data-label={t.langCol}>
                            <LangSelect
                              value={p.lang}
                              onValueChange={(v) => patch(p.id, { lang: v })}
                              options={LANG_OPTIONS.map((l) => ({ value: l, label: l }))}
                              label={`${t.langCol}: ${p.name}`}
                            />
                          </td>
                          <td data-label={t.noteCol}>
                            <input
                              key={`${p.id}:${p.note}`}
                              className="cell-input note"
                              defaultValue={p.note}
                              maxLength={60}
                              placeholder="–"
                              aria-label={`${t.noteCol}: ${p.name}`}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== p.note) patch(p.id, { note: v });
                              }}
                              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            />
                          </td>
                          <td data-label={t.mode}>
                            <span className="car-cell">
                              <button
                                className={`chip${p.car ? " on" : ""}`}
                                onClick={() => patch(p.id, { car: !p.car })}
                                aria-pressed={p.car}
                                aria-label={`${t.mode}: ${p.name}`}
                              >
                                <Car size={14} aria-hidden />
                              </button>
                              {p.car ? (
                                <span className="mini" role="group" aria-label={t.seatsOf}>
                                  <button onClick={() => patch(p.id, { seats: Math.max(MIN_SEATS, p.seats - 1) })} aria-label="−"><Minus size={12} aria-hidden /></button>
                                  <span>{p.seats} {t.seatsOf}</span>
                                  <button onClick={() => patch(p.id, { seats: Math.min(CAR_SEATS, p.seats + 1) })} aria-label="+"><Plus size={12} aria-hidden /></button>
                                </span>
                              ) : null}
                            </span>
                          </td>
                          {LEGS.map((lg, i) => (
                            <td key={i} data-label={`${t.leg} ${i + 1}`}>
                              <button
                                className={`chip${p.legs[i] ? " on" : ""}`}
                                onClick={() => toggleLeg(p, i)}
                                aria-pressed={p.legs[i]}
                                aria-label={`${t.leg} ${i + 1}: ${p.name}`}
                              >
                                {p.legs[i] ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} aria-hidden />} {lg.time}
                              </button>
                            </td>
                          ))}
                          <td data-label={t.assign}>
                            {a ? (
                              <span className="assign">
                                <span className={`pill ${a.kind}`}>{a.label}</span>
                                {a.role ? <span className="role"> · {a.role}</span> : null}
                              </span>
                            ) : (
                              <span className="assign"><span className="pill away">{t.notThere}</span></span>
                            )}
                          </td>
                          <td className="c-del" data-label="">
                            <button className="icon-btn" onClick={() => removePerson(p.id)} aria-label={`${t.remove}: ${p.name}`} title={t.remove}>
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
    ),
    cards: (
            <Reveal id="cards" className="tile">
              <h2 className="tile-title">{t.cardsH}</h2>
              <p className="tile-note">{t.cardsSub}</p>
              <div className="box-tools">
                <button
                  className="ghost"
                  onClick={() =>
                    copyCards(
                      legCards[leg].cards.map((c) => cardText(c, legHead(L, leg), t)).join("\n\n"),
                      t.copied
                    )
                  }
                >
                  <Copy size={15} aria-hidden /> {t.copyLeg}
                </button>
              </div>
              <div className="plan-grid">
                {legCards[leg].cards.map((c) => (
                  <article key={c.id} className="pcard info-card">
                    <div className="pcard-head">
                      <h3>{c.title}</h3>
                      <button className="icon-btn" onClick={() => copyCards(cardText(c, legHead(L, leg), t), t.copied)} aria-label={`${t.copy}: ${c.title}`} title={t.copy}>
                        <Copy size={16} aria-hidden />
                      </button>
                    </div>
                    {c.lead ? (
                      <p className="info-lead">
                        <span>{c.lead[0]}</span> {c.lead[1]}
                      </p>
                    ) : null}
                    <p className="info-label">{c.kind === "car" ? t.passengers : t.members}</p>
                    <p className="info-people">{c.people.join(", ") || "–"}</p>
                  </article>
                ))}
              </div>
            </Reveal>
    ),
  };

  return (
    <TagCtx.Provider value={tagCtx}>
    <div className={`cp${dnd.drag ? " dragging" : ""}${picked ? " picking" : ""}${layoutEdit ? " layout-editing" : ""}`}>
      {note ? (
        <div className="toast" role="status">
          {note}
        </div>
      ) : null}
      {pickedPerson ? (
        <div className="pick-bar" role="status">
          <span>
            <strong>{pickedPerson.name}</strong> {t.picked}
          </span>
          <button onClick={() => setPicked(null)}>{t.cancel}</button>
        </div>
      ) : null}
      {dnd.drag ? (
        <div className="drag-ghost" style={{ left: dnd.drag.x, top: dnd.drag.y }}>
          {dnd.drag.person.name}
        </div>
      ) : null}
      {rulesOpen ? (
        <div className="modal-backdrop" onClick={() => setRulesOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={t.rulesH} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{t.rulesH}</h2>
              <button className="icon-btn" onClick={() => setRulesOpen(false)} aria-label={t.close} title={t.close}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="modal-scroll">
              <div className="rules-head">
                <p className="tile-note">{t.rulesSub}</p>
                <LangSelect
                  className="wide add-rule"
                  align="end"
                  noClear
                  value=""
                  placeholder={t.addRule}
                  label={t.addRule}
                  options={RULE_TYPES.map((k) => ({ value: k, label: t.ruleTypes[k] }))}
                  onValueChange={(v) => v && addRule(v)}
                />
              </div>
              {rules.length ? (
                <ul className="rule-list-edit">
                  {rules.map((r) => (
                    <RuleRow key={r.id} rule={r} persons={persons} teams={teamList} t={t} onChange={changeRule} onRemove={() => removeRule(r.id)} />
                  ))}
                </ul>
              ) : (
                <p className="rules-empty">{t.noRules}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {layoutEdit ? (
        <div className="layout-bar" role="toolbar" aria-label={t.layoutH}>
          <div className="lb-variants" role="group" aria-label={t.variants}>
            {[{ id: null, name: t.defaultVariant }, ...variants].map((v) =>
              renaming && renaming === v.id ? (
                <input
                  key={v.id}
                  className="lb-rename"
                  defaultValue={v.name}
                  maxLength={24}
                  autoFocus
                  aria-label={t.rename}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => renameVariant(v.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  key={v.id ?? "default"}
                  className={activeId === v.id ? "on" : ""}
                  onClick={() => applyVariant(v.id)}
                  onDoubleClick={() => v.id && setRenaming(v.id)}
                  aria-pressed={activeId === v.id}
                >
                  {v.name}
                  {activeId === v.id && layoutDirty ? <i title={t.changed} /> : null}
                </button>
              )
            )}
          </div>
          <div className="lb-tools">
            <button className="lb-icon" onClick={undoOrder} disabled={!layoutPast.length} aria-label={t.undoOrder} title={t.undoOrder}>
              <Undo2 size={18} aria-hidden />
            </button>
            {activeVariant ? (
              <button className="lb-icon save" onClick={updateVariant} disabled={!layoutDirty} aria-label={t.save} title={t.save}>
                <Save size={18} aria-hidden />
              </button>
            ) : null}
            <button className="lb-icon" onClick={saveVariantAs} aria-label={t.newVariant} title={t.newVariant}>
              <Plus size={18} aria-hidden />
            </button>
            {activeVariant ? (
              <button className="lb-icon" onClick={() => setRenaming(activeVariant.id)} aria-label={t.rename} title={t.rename}>
                <Pencil size={17} aria-hidden />
              </button>
            ) : null}
            {activeVariant ? (
              <button className="lb-icon" onClick={deleteVariant} aria-label={t.deleteVariant} title={t.deleteVariant}>
                <Trash2 size={18} aria-hidden />
              </button>
            ) : null}
            <button className="lb-done" onClick={() => setLayoutEdit(false)}>
              <Check size={16} aria-hidden /> {t.done}
            </button>
          </div>
        </div>
      ) : null}
      <header className={`cp-nav${scrolled ? " scrolled" : ""}`}>
        <img className="cp-logo" src={logo} alt="alseda Consulting" />
        <div className="cp-nav-right">
          <nav className="cp-nav-links" aria-label={t.goTo}>
            {sectionLinks.map((l) => (
              <a key={l.id} href={`#${l.id}`} className={activeSec === l.id ? "on" : ""}>
                {l.nav}
              </a>
            ))}
          </nav>
          <button className={`cp-layout-btn${layoutEdit ? " on" : ""}`} onClick={() => setLayoutEdit((o) => !o)} aria-pressed={layoutEdit}>
            <LayoutList size={16} aria-hidden /> <span>{t.layout}</span>
          </button>
          <div className="cp-lang" role="group" aria-label="Language">
            {["de", "en"].map((l) => (
              <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)} aria-pressed={l === lang}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="cp-menu-btn" onClick={openDrawer} aria-label={t.menu} aria-haspopup="dialog" title={t.menu}>
            <Menu size={20} aria-hidden />
          </button>
        </div>
      </header>
      {drawerOpen ? (
        <div className={`drawer-backdrop${drawerClosing ? " closing" : ""}`} onClick={() => closeDrawer()}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={t.menu} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <img className="drawer-logo" src={logo} alt="alseda Consulting" />
              <strong className="drawer-title">{t.plannerMenu}</strong>
              <button className="icon-btn" onClick={() => closeDrawer()} aria-label={t.close} title={t.close}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="drawer-scroll">
              <nav className="drawer-links" aria-label={t.goTo}>
                {sectionLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <a key={l.id} href={`#${l.id}`} className={activeSec === l.id ? "on" : ""} onClick={() => closeDrawer()}>
                      <Icon size={18} aria-hidden />
                      <span>{l.label}</span>
                      <b>{l.count}</b>
                    </a>
                  );
                })}
              </nav>
              <div className="drawer-actions">
                <button className="ghost" onClick={() => closeDrawer(() => setLayoutEdit(true))}>
                  <LayoutList size={16} aria-hidden /> {t.layout}
                </button>
                <button className="ghost" onClick={() => closeDrawer(() => setRulesOpen(true))}>
                  <ListPlus size={16} aria-hidden /> {t.rulesBtn}
                </button>
              </div>
              <button className="btn-grad drawer-export" onClick={() => closeDrawer(() => exportPlan())}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
            </div>
            <div className="drawer-bottom">
              <div className="drawer-lang">
                <span className={lang === "de" ? "on" : ""}>Deutsch</span>
                <button
                  className={`lang-switch${lang === "en" ? " en" : ""}`}
                  role="switch"
                  aria-checked={lang === "en"}
                  aria-label="Language"
                  onClick={() => setLang(lang === "de" ? "en" : "de")}
                >
                  <i />
                </button>
                <span className={lang === "en" ? "on" : ""}>English</span>
              </div>
              <div className="drawer-foot">
                <span>© {new Date().getFullYear()} {t.rights}</span>
                <a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">
                  <WebIcon />
                </a>
                <a href="https://uk.linkedin.com/company/alseda-consulting" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
                  <LinkedInIcon />
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="cp-wrap">
        <div className="cp-bento">
          <div className="cp-inner">
            {/* hero */}
            <div className="cp-hero">
              <div className="tile hero-main">
                <img className="hero-photo" src={photo} alt="" />
                <h1>
                  {t.title.split("Year-End").flatMap((part, i, a) =>
                    i < a.length - 1 ? [part, <span key={i} style={{ whiteSpace: "nowrap" }}>Year-End</span>] : [part]
                  )}
                </h1>
                <p>{t.sub}</p>
              </div>
              <div className="hero-side">
                <div className="hero-holo lilac">
                  <p className="holo-label">
                    {t.leg} {leg + 1} · {L.time} {t.oclock}
                  </p>
                  <p className="holo-venue">
                    {from} → {to}
                  </p>
                  <p className="holo-addr">{L.to.addr}</p>
                </div>
                <div className="hero-holo green">
                  <dl className="holo-facts">
                    <div>
                      <dt>{t.date}</dt>
                      <dd>{eventDate}</dd>
                    </div>
                    <div>
                      <dt>{t.depart}</dt>
                      <dd>{L.time} {t.oclock}</dd>
                    </div>
                    <div>
                      <dt>{t.persons}</dt>
                      <dd>{onLeg}</dd>
                    </div>
                  </dl>
                  <p className="holo-demo">
                    <span>{t.demo}</span>
                  </p>
                </div>
              </div>
            </div>

            {sectionOrder.map((k, i) => (
              <React.Fragment key={k}>
                {layoutEdit ? (
                  <MoveBar
                    label={t.sections[k]}
                    first={i === 0}
                    last={i === sectionOrder.length - 1}
                    onUp={() => moveSection(i, -1)}
                    onDown={() => moveSection(i, 1)}
                    t={t}
                  />
                ) : null}
                {blocks[k]}
              </React.Fragment>
            ))}

            {/* rules (the template's benefits block) */}
            <Reveal className="tile">
              <div className="rules">
                <div>
                  <h2 className="tile-title">{t.ruleH}</h2>
                  <p className="tile-note">{t.ruleSub}</p>
                </div>
                <div className="rule-list">
                  {t.rules.map((r, i) => (
                    <div key={i} className="rule">
                      <span className="tick" style={{ background: RULE_GRADS[i % RULE_GRADS.length] }}>
                        <Check size={16} strokeWidth={3} aria-hidden />
                      </span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* dark closing tile */}
            <Reveal className="tile dark">
              <h2>{t.darkH(onLeg)}</h2>
              <p>{from} → {to}</p>
              <button className="btn-grad" onClick={exportPlan}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
              <small>{t.demo}</small>
            </Reveal>

            <footer className="tile cp-foot">
              <div className="foot-top">
                <div className="foot-brand">
                  <img className="cp-logo foot" src={logo} alt="alseda Consulting" />
                </div>
                <nav className="foot-links">
                  <a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">
                    <WebIcon />
                  </a>
                  <a
                    href="https://uk.linkedin.com/company/alseda-consulting"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    title="LinkedIn"
                  >
                    <LinkedInIcon />
                  </a>
                </nav>
              </div>
              <div className="foot-bottom">
                <span>
                  © {new Date().getFullYear()} {t.rights}
                </span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
    </TagCtx.Provider>
  );
}
