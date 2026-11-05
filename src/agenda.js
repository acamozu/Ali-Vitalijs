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
export const AGENDA = [
  { from: "09:00", to: "09:30", type: "break", title: "Welcome Coffee & Snacks" },
  { from: "09:30", to: "10:30", type: "session", title: "Official Welcome", speaker: "Frank", minutes: 60 },
  { from: "10:30", to: "10:45", type: "break", title: "Break – Speaker Change" },
  { from: "10:45", to: "11:15", type: "session", title: "Project Prospects 2027", speaker: "Oliver", minutes: 30 },
  { from: "11:15", to: "11:30", type: "break", title: "Break – Speaker Change" },
  { from: "11:30", to: "12:00", type: "session", title: "Load & Performance in SAP PE & TRBK", speaker: "David / Julian", minutes: 30 },
  { from: "12:00", to: "12:30", type: "session", title: "Marketing Insights: Reflect, Connect & Celebrate", speaker: "Loredana", minutes: 30 },
  { from: "12:30", to: "14:00", type: "break", title: "Break – Lunch" },
  { from: "14:00", to: "14:30", type: "session", title: "AI Live Demo", speaker: "Vitalijs / Ali", minutes: 30 },
  {
    from: "14:30",
    to: "15:00",
    type: "session",
    title: "Stablecoins: Hype or the Future of Payments?",
    subtitle: "SAP Pay & alseda – Review 2026 and Outlook 2027",
    speaker: "Michael",
    minutes: 30,
  },
  {
    from: "15:00",
    type: "social",
    title: "Start of the Christmas Party",
    subtitle: "Transfer to the Former Police Headquarters",
    location: "Frankfurt am Main",
  },
  {
    from: "16:00",
    to: "18:00",
    type: "social",
    title: "Guided Lost Places Tour",
    subtitle: "“Old Police Headquarters Frankfurt”",
    location: "Friedrich-Ebert-Anlage 11, 60327 Frankfurt am Main",
  },
  {
    from: "18:00",
    type: "social",
    title: "Transfer to Casa Isoletta",
    subtitle: "From the Old Police Headquarters Frankfurt",
  },
  {
    from: "19:00",
    type: "social",
    title: "Dinner at Casa Isoletta",
    location: "Babenhäuser Landstraße 1, 60599 Frankfurt am Main",
  },
];

const toDate = (hhmm) => new Date(`${EVENT.date}T${hhmm}:00${EVENT.tz}`);

// resolve start/end Dates; open-ended items end where the next begins (last: +3h)
export const SLOTS = AGENDA.map((a, i) => {
  const next = AGENDA[i + 1];
  const start = toDate(a.from);
  const end = a.to ? toDate(a.to) : next ? toDate(next.from) : new Date(start.getTime() + 3 * 3600e3);
  return { ...a, id: i, start, end, to: a.to || (next ? next.from : null) };
});

export const EVENT_START = SLOTS[0].start;
export const EVENT_END = SLOTS[SLOTS.length - 1].end;
