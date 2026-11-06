// Agenda data – alseda Consulting Year-End Conference, 27 Nov 2026 (Frankfurt, CET = +01:00)
export const EVENT = {
  title: "Year-End Conference",
  company: "alseda Consulting",
  date: "2026-11-27",
  tz: "+01:00",
  venue: "JW Marriott, Salon I",
  address: "Thurn-und-Taxis-Platz 2, 60313 Frankfurt",
};

// type: session | break | social
// "to" is optional: if missing, the item ends when the next one starts
// title / subtitle are { de, en }; location is a plain address
export const AGENDA = [
  { section: { de: "Konferenz", en: "Conference" }, icon: "coffee", from: "09:00", to: "09:30", type: "break", title: { de: "Willkommens\u00adkaffee & Snacks", en: "Welcome Coffee & Snacks" } },
  { icon: "hand", from: "09:30", to: "10:30", type: "session", title: { de: "Offizielle Begrüßung", en: "Official Welcome" }, speaker: "Frank" },
  { icon: "coffee", from: "10:30", to: "10:45", type: "break", title: { de: "Pause – Referenten\u00adwechsel", en: "Break – Speaker Change" } },
  { icon: "chart", from: "10:45", to: "11:15", type: "session", title: { de: "Projekt\u00adausblick 2027", en: "Project Prospects 2027" }, speaker: "Oliver" },
  { icon: "coffee", from: "11:15", to: "11:30", type: "break", title: { de: "Pause – Referenten\u00adwechsel", en: "Break – Speaker Change" } },
  {
    icon: "gauge",
    from: "11:30", to: "12:00", type: "session",
    title: { de: "Load & Performance in SAP PE & TRBK", en: "Load & Performance in SAP PE & TRBK" },
    speaker: "David / Julian",
  },
  {
    icon: "chat",
    from: "12:00", to: "12:30", type: "session",
    title: { de: "Marketing Insights: Reflect, Connect & Celebrate", en: "Marketing Insights: Reflect, Connect & Celebrate" },
    speaker: "Loredana",
  },
  { icon: "food", from: "12:30", to: "14:00", type: "break", title: { de: "Pause – Mittagessen", en: "Break – Lunch" } },
  { icon: "chip", from: "14:00", to: "14:30", type: "session", title: { de: "KI-Live-Demo", en: "AI Live Demo" }, speaker: "Vitalijs / Ali" },
  {
    icon: "coin",
    from: "14:30", to: "15:00", type: "session",
    title: { de: "Stablecoins: Hype oder Zukunft des Zahlungs\u00adverkehrs?", en: "Stablecoins: Hype or the Future of Payments?" },
    subtitle: { de: "SAP Pay & alseda – Rückblick 2026 und Ausblick 2027", en: "SAP Pay & alseda – Review 2026 and Outlook 2027" },
    speaker: "Michael",
  },
  {
    section: { de: "Weihnachts\u00adfeier", en: "Christmas Party" },
    icon: "star",
    from: "15:00", type: "social",
    title: { de: "Beginn der Weihnachts\u00adfeier", en: "Start of the Christmas Party" },
    subtitle: { de: "Transfer zum ehemaligen Polizei\u00adpräsidium", en: "Transfer to the Former Police Headquarters" },
    location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main",
  },
  {
    icon: "pin",
    from: "16:00", to: "18:00", type: "social",
    title: { de: "Geführte Lost-Places-Tour", en: "Guided Lost Places Tour" },
    subtitle: { de: "„Altes Polizei\u00adpräsidium Frankfurt“", en: "“Old Police Headquarters Frankfurt”" },
    location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main",
  },
  {
    icon: "bus",
    from: "18:00", type: "social",
    title: { de: "Transfer zum Casa Isoletta", en: "Transfer to Casa Isoletta" },
    location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main",
    subtitle: { de: "Vom Alten Polizei\u00adpräsidium Frankfurt", en: "From the Old Police Headquarters Frankfurt" },
  },
  {
    icon: "food",
    from: "19:00", type: "social",
    title: { de: "Abendessen im Casa Isoletta", en: "Dinner at Casa Isoletta" },
    location: "Babenhäuser Landstraße 1, 60599 Frankfurt am Main",
  },
];

// resolve start/end Dates for a given calendar day; open-ended items end where the next begins (last: +3h)
export function buildSlots(date, tz) {
  const toDate = (hhmm) => new Date(`${date}T${hhmm}:00${tz}`);
  return AGENDA.map((a, i) => {
    const next = AGENDA[i + 1];
    const start = toDate(a.from);
    const end = a.to ? toDate(a.to) : next ? toDate(next.from) : new Date(start.getTime() + 3 * 3600e3);
    const minutes = Math.round((end - start) / 60000);
    return { ...a, id: i, start, end, minutes, hasEnd: Boolean(a.to), to: a.to || (next ? next.from : null) };
  });
}

export const SLOTS = buildSlots(EVENT.date, EVENT.tz);
export const EVENT_START = SLOTS[0].start;
export const EVENT_END = SLOTS[SLOTS.length - 1].end;

// UI texts
export const TEXT = {
  de: {
    dateLong: "27. November 2026",
    dateShort: "27.11.2026",
    scan: "QR-Code scannen und die Live-Agenda öffnen",
    openAgenda: "Agenda öffnen",
    welcome: "Willkommen zur",
    now: "Jetzt",
    left: (m) => `noch ${m} Min.`,
    next: "Als Nächstes",
    min: "Min.",
    openEnd: "Ende offen",
    before: (t) => `Beginn um ${t} Uhr`,
    after: "Die Veranstaltung ist beendet. Vielen Dank!",
    agenda: "Programm",
    rights: "Alle Rechte vorbehalten.",
  },
  en: {
    dateLong: "27 November 2026",
    dateShort: "27 Nov 2026",
    scan: "Scan the QR code to open the live agenda",
    openAgenda: "Open agenda",
    welcome: "Welcome to the",
    now: "Now",
    left: (m) => `${m} min left`,
    next: "Up next",
    min: "min",
    openEnd: "Open end",
    before: (t) => `Starts at ${t}`,
    after: "The event has ended. Thank you!",
    agenda: "Agenda",
    rights: "All rights reserved.",
  },
};
